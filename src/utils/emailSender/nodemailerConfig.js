const nodemailer = require("nodemailer");
const config = require("config");

const transporter = nodemailer.createTransport({
  host: config.get("EMAIL.HOST"),
  port: config.get("EMAIL.PORT"),
  secure: config.get("EMAIL.SECURE"), // true for port 465, false for other ports
  auth: {
    user: config.get("EMAIL.AUTH.USER"),
    pass: config.get("EMAIL.AUTH.PASS"),
  },
});

// async..await is not allowed in global scope, must use a wrapper
async function main(to, subject, text, html) {
  // send mail with defined transport object
  const info = await transporter.sendMail({
    from: `"FADAK PROGRAMMER" <${"fadakprgrammer@gmail.com"}>`,
    to: to, // list of receivers-> string for users use , between each email
    subject: subject, // Subject line
    text: text, // plain text body
    html: html,
  });
  console.log("Message sent: %s", info.messageId);

  // Message sent: <d786aa62-4e0a-070a-47ed-0b0666549519@ethereal.email>
}
//main().catch(console.error);کامنت شد چون در هر فایلی که فراخوانی شود این کد رو مینویسسیم
module.exports = { main };
