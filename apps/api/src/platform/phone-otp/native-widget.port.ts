export interface NativeWidgetPort {
  send(phone: string): Promise<string>;
  resend(reqId: string): Promise<string>;
  verify(reqId: string, otp: string): Promise<string>;
}
