const nconf = require("nconf");
const bull = require("bull");
const path = require('path');
const nodemailer = require("nodemailer");
const emailQueue = new bull("emailQueue", {
  redis: { port: 6379, host: "localhost", db: 3 },
});
const emailCopy = require("./emailcopy");

// config file load
// load config file
nconf
  .argv()
  .env()
  .file({ file: path.join(__dirname,'../',"config.json" )});

// connect to SES
const smtpTransport = nodemailer.createTransport({
    host: nconf.get("sesHost"),
    port: 465,
    secure: true,
    pool: true,
    rateDelta: 1000, // time in ms
    rateLimit: 1, // 1 emails per second, else pause
    auth: {
      user: nconf.get("sesUserName"),
      pass: nconf.get("sesPassword"),
    },
});

// connect to queue
console.log("Subscribed to the Queue");

emailQueue.process((job, done) => {
  if (job.data) {
    // if job exists for the email queue, send it out
    sendEmail(job.data, done);
  }
  done();
});

function sendEmail(data, done) {
    var mailOptions = {};
    switch (data.type) {
      case "account_confirmation_email":
        let emailBody = emailCopy.account_confirmation_email.body.replace(
          "##name##",
          data.name
        );
        emailBody = emailBody.replace(
          "##confirmation_link##",
          data.confirmationLink
        );
        mailOptions = {
          from: nconf.get("fromAddress"),
          to: data.toAddress,
          subject: emailCopy.account_confirmation_email.subject,
          html: emailBody,
        };
        break;
      case "forgot_password":
        let forgotPasswordEmailBody = emailCopy.forgot_password_email.body.replace(
          "##name##",
          data.name
        );
        forgotPasswordEmailBody = forgotPasswordEmailBody.replace(
          "##forgot_password_link##",
          data.forgetPasswordLink
        );
        mailOptions = {
          from: nconf.get("fromAddress"),
          to: data.toAddress,
          subject: emailCopy.forgot_password_email.subject,
          html: forgotPasswordEmailBody,
        };
        break;
      case "contact":
        mailOptions = {
          from: nconf.get("fromAddress"),
          to: data.toAddress,
          subject: data.subject,
          html: data.content,
          replyTo: data.replyTo,
        };
        break;
      default:
        break;
    }
  
    smtpTransport.sendMail(mailOptions, (err, response) => {
      if (err) {
        console.log(err);
        done(new Error(err));
      }
      console.log(`Email sent to ${mailOptions.to}`);
      done();
    });
}