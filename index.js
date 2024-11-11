import mysql from "mysql2";
import express from "express";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import cors from "cors";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import JWT from 'jsonwebtoken';


const corsOptions = {
  origin: (origin, callback) => {
    callback(null, true)
  },
  method: ['POST', 'GET', 'DELETE', 'PUT'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
};

const app = express();
app.use(express.json());
dotenv.config();
app.use(cors(corsOptions));
app.use(cookieParser());

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  queueLimit: 0,
  connectionLimit: 10,
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection failed", err.stack);
    return;
  }
  console.log("Database connected" + " " + connection.threadId);
  connection.release();
});

db.query('UPDATE TABLE users ADD role(ENUM')

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.DB_EU,
    pass: process.env.DB_EP,
  },
});

app.post("/send", (req, res) => {
  const { senderEmail, subject, message } = req.body;

  const mailOption = {
    from: process.env.DB_EU,
    to: process.env.DB_EU,
    replyTo: senderEmail,
    subject: subject,
    text: message,
  };

  transporter.sendMail(mailOption, (error, info) => {
    if (error) {
      console.log("error", error);
      res.status(500).send("Fail to send mail");
    }
    res.status(200).send("Email sent successfully");
  });
});

/*const sql = `CREATE TABLE IF NOT EXISTS users(id INT PRIMARY KEY AUTO_INCREMENT,
first_name VARCHAR(255), last_name VARCHAR(255), phone_number VARCHAR(15), email VARCHAR(255), password VARCHAR(255))`;

db.query(sql, (err, result) => {
    if (err) {
         console.log('Failed to create table');
         return;
        }
        console.log('table created successfully')
});*/

//Route to register user
app.post("/register", async (req, res) => {
  const { first_name, last_name, phone_number, email, password } = req.body;
  const sql = `SELECT * FROM users WHERE email = ?`;
  db.query(sql, [email], async (err, result) => {
    if (err) {
      console.log("Error checking user", err);
      return res.status(500).json({ message: "Error checking user" });
    }
    if (result.length > 0) {
      return res.status(400).json({ message: "User already exist" });
    }
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const sql = `INSERT INTO users(first_name, last_name, phone_number, email, password) VALUES (?, ?, ?, ?, ?)`;
      db.query(
        sql,
        [first_name, last_name, phone_number, email, hashedPassword],
        (err, result) => {
          if (err) {
            console.log("Error registering user", err);
            return res.status(500).json({ message: "Error registering user" });
          }
          return res
            .status(200)
            .json({ message: "User registerd successfully" });
        }
      );
    } catch (hash) {
      console.log("Error hashning password", hash);
      return res.status(500).json({ message: "Error processing request" });
    }
  });
});

//Login user route
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.query(`SELECT * FROM users WHERE email = ?`, [email], (err, result) => {
    if (err || result.length === 0) {
      return res.status(404).json({error: 'User not found'});
    }
    const user = result[0];
    const isPasCorrect = bcrypt.compareSync(password, user.password);

    if (!isPasCorrect) {
      return res.status(401).json({error: 'Incorrect password'});
    }

    const token = JWT.sign({id: user.id}, process.env.JWT_SECRET, {expiresIn: '1h'});
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none'
    });
    res.status(200).json({message: 'Login succesful'});
  });
});

//route to logout
app.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.json({message: 'Logout successfully'});
});

app.listen(3002, () => {
  console.log("Server is running on port 3002");
});
