resource "aws_s3_bucket" "media" {
  bucket        = "${local.name}-media-${local.account}"
  force_destroy = false
}
resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_ownership_controls" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = "Enabled"
  }
}
resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    id     = "bounded-history"
    status = "Enabled"
    filter {
      prefix = ""
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}
resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  cors_rule {
    allowed_origins = [var.web_origin]
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_headers = ["content-type", "content-length", "x-amz-*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 300
  }
}
resource "aws_s3_bucket_policy" "media" {
  bucket = aws_s3_bucket.media.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Sid      = "DenyInsecureTransport", Effect = "Deny", Principal = "*", Action = "s3:*",
      Resource = [aws_s3_bucket.media.arn, "${aws_s3_bucket.media.arn}/*"],
      Condition = {
        Bool = {
          "aws:SecureTransport" = "false"
        }
      }
      }
    ]
    }
  )
}
resource "aws_acm_certificate" "media" {
  provider          = aws.edge
  domain_name       = var.media_domain
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}
resource "aws_route53_record" "media_validation" {
  for_each = {
    (var.media_domain) = one(aws_acm_certificate.media.domain_validation_options)
  }
  zone_id = var.zone_id
  name    = each.value.resource_record_name
  type    = each.value.resource_record_type
  records = [each.value.resource_record_value]
  ttl     = 60
}
resource "aws_acm_certificate_validation" "media" {
  provider                = aws.edge
  certificate_arn         = aws_acm_certificate.media.arn
  validation_record_fqdns = [for r in aws_route53_record.media_validation : r.fqdn]
}
resource "aws_cloudfront_cache_policy" "media" {
  name        = "${local.name}-media"
  min_ttl     = 0
  default_ttl = 60
  max_ttl     = 60
  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}
resource "aws_cloudfront_function" "media_only" {
  name    = "${local.name}-media-only"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
      var r = event.request;
      if (!/^\/media\/by-media\/[0-9a-f-]{36}\/(320|640|1024|1600)\.webp$/.test(r.uri)) {
        return { statusCode: 404, statusDescription: 'Not Found', headers: { 'cache-control': { value: 'no-store' } } };
      }
      return r;
    }
  JS
}
resource "aws_cloudfront_distribution" "media" {
  enabled         = true
  is_ipv6_enabled = true
  aliases         = [var.media_domain]
  price_class     = "PriceClass_All"
  http_version    = "http2and3"
  origin {
    domain_name = var.api_domain
    origin_id   = "authorized-media-api"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  default_cache_behavior {
    target_origin_id       = "authorized-media-api"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = aws_cloudfront_cache_policy.media.id
    compress               = true
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.media_only.arn
    }
  }
  custom_error_response {
    error_code            = 404
    error_caching_min_ttl = 0
  }
  custom_error_response {
    error_code            = 503
    error_caching_min_ttl = 0
  }
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.media.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}
resource "aws_route53_record" "media" {
  for_each = toset(["A", "AAAA"])
  zone_id  = var.zone_id
  name     = var.media_domain
  type     = each.key
  alias {
    name                   = aws_cloudfront_distribution.media.domain_name
    zone_id                = aws_cloudfront_distribution.media.hosted_zone_id
    evaluate_target_health = false
  }
}
