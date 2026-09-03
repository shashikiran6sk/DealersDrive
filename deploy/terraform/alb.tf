# ---------------------------------------------------------------------------
# The edge.
#
# One hostname serves the whole application, and that is a security decision
# rather than a convenience: web and API on one origin is what lets the session
# cookie be host-only. A cookie scoped to `.dealers-drive.com` would be sent to
# every other environment on that domain — a dev session presented to
# production (§F4).
#
# Path routing mirrors deploy/nginx/dealers-drive.conf exactly, so the single-VM
# topology and this one behave the same way. Three prefixes belong to the API;
# everything else is Next.js.
# ---------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "Public HTTPS in, application traffic out"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP, redirected to HTTPS by the listener below"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# The tasks accept traffic from the load balancer and from nothing else. Not
# from each other, and not from the internet — this is what makes running in
# private subnets meaningful rather than decorative.
resource "aws_security_group" "tasks" {
  name        = "${local.name}-tasks"
  description = "Application tasks: ingress only from the load balancer"
  vpc_id      = var.vpc_id

  ingress {
    description     = "API port, from the load balancer only"
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Web port, from the load balancer only"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Postgres, R2, Google OAuth, MSG91"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "this" {
  name                       = local.name
  load_balancer_type         = "application"
  subnets                    = var.public_subnet_ids
  security_groups            = [aws_security_group.alb.id]
  enable_deletion_protection = var.enable_deletion_protection

  # Longer than the API's keep-alive timeout (61s in apps/api/src/index.ts).
  # If the load balancer's idle timeout were the longer of the two, it could
  # send a request down a connection the task had already decided to close, and
  # the client would see a 502 that no log explains.
  idle_timeout = 60

  drop_invalid_header_fields = true
}

# ── target groups ─────────────────────────────────────────────────────────
#
# `deregistration_delay` is what makes the two-phase shutdown work end to end.
# The task answers 503 on /health/ready the instant SIGTERM arrives and then
# waits SHUTDOWN_DRAIN_MS before closing the listener; this is the load
# balancer's half of that handshake — it stops sending new requests and waits
# for the in-flight ones. Too short and a request in progress is cut off; too
# long and every deploy crawls.

resource "aws_lb_target_group" "api" {
  name                 = "${local.name}-api"
  port                 = 4000
  protocol             = "HTTP"
  vpc_id               = var.vpc_id
  target_type          = "ip"
  deregistration_delay = 30

  health_check {
    path = "/health/ready"
    # /health/ready, not /health/live: readiness answers "can this task serve
    # NEW traffic", which is the only question a target group is asking. It is
    # also what returns 503 during a drain, and what reports the deployed SHA
    # so a promotion can verify which build is serving (§20.3).
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group" "web" {
  name                 = "${local.name}-web"
  port                 = 3000
  protocol             = "HTTP"
  vpc_id               = var.vpc_id
  target_type          = "ip"
  deregistration_delay = 30

  health_check {
    # Renders no data and calls no upstream, so it answers "is this process
    # serving" and never fails because the API is down.
    path                = "/api/health"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

# ── listeners ─────────────────────────────────────────────────────────────
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  # Everything that is not an API prefix is the Next.js app.
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

# Lower priority number wins. These three prefixes are the entire API surface
# reachable from a browser: the versioned API (including the OAuth redirect the
# browser navigates to), the media bytes, and the health probes.
#
# `/api/docs` is deliberately NOT routed here — it would shadow the web app's
# own /api/* BFF routes, which is the one collision this layout can produce.
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/v1/*", "/media/*", "/health/*"]
    }
  }
}
