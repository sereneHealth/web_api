import mysql from 'mysql2';
import express from 'express';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import cors from 'cors';

const app = express();
app.use(express.json());
dotenv.config();
app.use(cors());

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    queueLimit: 0,
    connectionLimit: 10
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed', err.stack);
        return;
    }
    console.log('Database connected' + '' + connection.threadId);
    connection.release();
})

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user:  'bankoleazeezb98@gmail.com',
        pass: 'fgeqqnzwbcvygbhj'
    }
});

app.post('/send_mail', (req, res) => {
    const { recipient, subject, message } = req.body;

    const mailOption = {
        from: 'bankoleazeezbabatunde@gmail.com',
        to: recipient,
        subject: subject,
        text: message
    };

    transporter.sendMail(mailOption, (error, info) => {
        if (error) {
            console.log('error', error);
            return res.status(500).json({message: 'Fail to send mail'})
        }
        res.status(200).json({message: 'Email sent successfully'})
        });
});



app.listen(3002, () => {
    console.log('Server is running on port 3000');
});