# Background monitoring

One-shot operations process reads only aggregate queue/outbox/permanent delivery
counts and ages. It prints no payloads or recipients. The host exports bounded
CloudWatch dimensions and terminates this DB connection after each collection.
API/worker pools have explicit limits. Notification DLQ and failed deliveries
must both be inspected because a permanent provider error completes its queue
job while recording FAILED in the application's delivery table.
