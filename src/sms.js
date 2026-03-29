import twilio from "twilio";

export async function sendSMS({ accountSid, authToken, from, to, body }) {
  const client = twilio(accountSid, authToken);
  const message = await client.messages.create({ body, from, to });
  console.log(`SMS sent to ${to}: ${message.sid}`);
  return message;
}
