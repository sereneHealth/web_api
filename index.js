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


//send mail to all user
app.post('/sendmail', (req, res) => {
  const { subjects, messages} = req.body;

  db.query(`SELECT email FROM newsletter`, (err, result) => {
    if (err) {
      console.log(err)
      return res.status(400).json({message: 'Error selecting user'});
    }

    const mailList = result.map((row) => row.email).join(',');
    console.log(mailList);

    const mailOption = {
      from: process.env.DB_EU,
      to: mailList,
      replyTo: process.env.DB_EU,
      subject: subjects,
      text: messages,
    };
  
    transporter.sendMail(mailOption, (error, info) => {
      if (error) {
        console.log("error", error);
        res.status(500).send("Fail to send mail");
      }
      res.status(200).send("Email sent successfully");
    });
  });
});

//submit mail for newsletter
app.post('/newsletter', (req, res) => {
  const {newsMail} = req.body;
  const sql = `SELECT * FROM newsletter WHERE email = ?`;
  db.query(sql, [newsMail], (err, result) => {
    if (err || result.length > 0) {
      return res.status(400).json({message: 'User already exist'})
    }
    const sql2 = `INSERT INTO newsletter(email) VALUES(?)`;
    db.query(sql2, [newsMail], (err, result) => {
      if (err) {
        console.log(err)
        return res.status(500).json({message: 'Error inserting email'});
      }
      res.status(200).json({message: 'Inserted successfully'});
      console.log('Email inserted');
    });
  });
});

//Route to register user
app.post("/register", async (req, res) => {
  const { first_name, last_name, phone_number, role, email, password } = req.body;
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
      const sql = `INSERT INTO users(first_name, last_name, phone_number, role, email, password) VALUES (?, ?, ?, ?, ?, ?)`;
      db.query(
        sql,
        [first_name, last_name, phone_number, role, email, hashedPassword],
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

//Middleware to unthenticate user
const AuthenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({message: 'Unauthorized'});
  }

  JWT.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({message: 'Invalid token'});
    }
    req.user = user;
    next();
  });
};


//Create post
app.post('/create/posts', AuthenticateToken, (req, res) => {
  const { image, title, content } = req.body;
  const userid = req.user.id
  const sql = `INSERT INTO posts (user_id, image, title, content) VALUES (?, ?, ?, ?)`;
  db.query(sql, [userid, image, title, content], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({message: 'Error creating post'});
    }
    res.status(200).json({message: 'Post created successfully'});
  });
});

//Route to fetch all blog post
app.get('/blog/post', (req, res) => {
  const sql = `SELECT * FROM posts`;
  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({error: 'Fail to fetch post'});
    }
    res.json(result);
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
