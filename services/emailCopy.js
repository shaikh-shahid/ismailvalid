module.exports = {
    account_confirmation_email: {
      subject: "Please confirm your email address",
      body:
        '<div style="font-size: 16px; font: arial;"><p>Hello <b>##name##</b>,</p><p>Thanks for joining Codeforgeek</p><p>Just one last step.</p><p>Please validate your email address in order to get started using Codeforgeek.</p><p>Click <a href="##confirmation_link##">here</a> to confirm your email.</p><hr><p>Thanks,</p><p>Shahid - <b>Codeforgeek.com</b></p></div>',
    },
    forgot_password_email: {
      subject: "Reset your password",
      body:
        '<div style="font-size: 16px; font: arial;"><p>Hey ##name##,</p><p>Seems like you forgot your Codeforgeek account password. To reset the password, click on the link below</p><p>Click <a href="##forgot_password_link##">here</a> to change your password.</p><hr><p>Thanks,</p><p>Shahid - <b>Codeforgeek.com</b></p></div>',
    },
  };