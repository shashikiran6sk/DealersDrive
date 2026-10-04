variable "region" {
  type    = string
  default = "ap-south-1"
}
variable "zone_id" {
  type = string
}
variable "api_domain" {
  type    = string
  default = "api.dealers-drive.com"
}
variable "media_domain" {
  type    = string
  default = "media.dealers-drive.com"
}
variable "web_origin" {
  type    = string
  default = "https://www.dealers-drive.com"
}
variable "alarm_email" {
  type = string
}
variable "monthly_budget_usd" {
  type    = number
  default = 50
}
variable "instance_type" {
  type    = string
  default = "t4g.small"
}
variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}
variable "db_multi_az" {
  type    = bool
  default = false
}
variable "db_storage_gb" {
  type    = number
  default = 20
}
variable "github_oidc_provider_arn" {
  type        = string
  description = "Existing GitHub OIDC provider ARN; do not create a second provider for the account."
}
variable "github_repository" {
  type    = string
  default = "shashikiran6sk/DealersDrive"
}
variable "github_environment" {
  type    = string
  default = "Production"
}
variable "config_kms_key_arn" {
  type        = string
  description = "KMS key encrypting externally populated runtime SecureString. Use its ARN, not an alias."
}
