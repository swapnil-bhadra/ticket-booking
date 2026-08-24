import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter (using Gmail SMTP)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Generate QR code as data URL
 * Encodes booking reference
 */
export async function generateQRCode(bookingReference) {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(bookingReference);
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

/**
 * Send booking confirmation email with QR code
 */
export async function sendBookingConfirmationEmail({
  email,
  name,
  eventTitle,
  eventDate,
  eventTime,
  seats,
  totalPrice,
  bookingReference,
  qrCodeDataUrl,
}) {
  try {
    const seatsList = seats.map(s => `<li>${s.seatNumber} - ${s.category} (₹${s.price})</li>`).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #667eea; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 20px; }
            .qr-section { text-align: center; margin: 20px 0; }
            .qr-section img { max-width: 250px; }
            .booking-details { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .seats-list { list-style: none; padding: 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Confirmed! 🎉</h1>
            </div>
            
            <div class="content">
              <p>Hello ${name},</p>
              <p>Your booking is confirmed! Here are your details:</p>
              
              <div class="booking-details">
                <h2>${eventTitle}</h2>
                <p><strong>Date:</strong> ${eventDate}</p>
                <p><strong>Time:</strong> ${eventTime}</p>
                <p><strong>Booking Reference:</strong> ${bookingReference}</p>
                
                <h3>Your Seats:</h3>
                <ul class="seats-list">
                  ${seatsList}
                </ul>
                
                <h3>Total Price: ₹${totalPrice}</h3>
              </div>
              
              <div class="qr-section">
                <p>Use this QR code to check in:</p>
                <img src="${qrCodeDataUrl}" alt="QR Code"/>
              </div>
              
              <p>Present this QR code at the venue for entry.</p>
              <p>If you need to cancel, visit our website and go to "My Bookings".</p>
              
              <div class="footer">
                <p>Thank you for booking with us!</p>
                <p>© 2024 Ticket Booking System</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Booking Confirmation: ${eventTitle} - ${bookingReference}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Booking email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending booking email:', error);
    throw error;
  }
}

/**
 * Send waitlist offer email with time-limited booking link
 */
export async function sendWaitlistOfferEmail({
  email,
  name,
  eventTitle,
  eventDate,
  eventTime,
  bookingLink,
  expiresAt,
}) {
  try {
    const expiryTime = new Date(expiresAt).toLocaleTimeString();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #48bb78; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 20px; }
            .cta-button {
              background-color: #48bb78;
              color: white;
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 5px;
              display: inline-block;
              margin: 20px 0;
            }
            .alert { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Great News! 🎟️</h1>
              <p>A seat has become available for you!</p>
            </div>
            
            <div class="content">
              <p>Hello ${name},</p>
              <p>A customer has cancelled their booking, and we've reserved a seat for you!</p>
              
              <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h2>${eventTitle}</h2>
                <p><strong>Date:</strong> ${eventDate}</p>
                <p><strong>Time:</strong> ${eventTime}</p>
              </div>
              
              <div class="alert">
                ⏰ <strong>Hurry!</strong> This offer expires at ${expiryTime}. 
                Complete your booking within the next hour.
              </div>
              
              <center>
                <a href="${bookingLink}" class="cta-button">Complete Your Booking Now</a>
              </center>
              
              <p>If the button doesn't work, copy and paste this link in your browser:</p>
              <p><code>${bookingLink}</code></p>
              
              <div class="footer">
                <p>Thank you for your interest!</p>
                <p>© 2024 Ticket Booking System</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Seat Available: ${eventTitle} - Offer Expires Soon!`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Waitlist offer email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending waitlist email:', error);
    throw error;
  }
}

/**
 * Send cancellation confirmation
 */
export async function sendCancellationEmail({
  email,
  name,
  eventTitle,
  bookingReference,
  refundAmount,
}) {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f56565; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Cancelled</h1>
            </div>
            
            <div class="content">
              <p>Hello ${name},</p>
              <p>Your booking has been successfully cancelled.</p>
              
              <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Event:</strong> ${eventTitle}</p>
                <p><strong>Booking Reference:</strong> ${bookingReference}</p>
                <p><strong>Refund Amount:</strong> ₹${refundAmount}</p>
              </div>
              
              <p>The refund will be processed to your original payment method within 5-7 business days.</p>
              <p>Thank you for using our platform!</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Cancellation Confirmed - ${bookingReference}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Cancellation email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending cancellation email:', error);
    throw error;
  }
}
