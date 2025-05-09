import mysql from "mysql2";
import express from "express";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import cors from "cors";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import JWT from "jsonwebtoken";
import multer from "multer";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.js";

const corsOptions = {
  origin: (origin, callback) => {
    callback(null, true);
  },
  method: ["POST", "GET", "DELETE", "PUT"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
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

//File upload
const upload = multer({ dest: "uploads/" });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.DB_EU,
    pass: process.env.DB_EP,
  },
});

// Swagger doccumment route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
app.post("/sendmail", upload.fields([{ name: "pdf" }]), async (req, res) => {
  const { subjects, messages } = req.body;
  const pdfFile = req.files["pdf"][0];

  db.query(`SELECT email, name FROM newsletter`, async (err, result) => {
    if (err) {
      console.log(err);
      return res.status(400).json({ message: "Error selecting user" });
    }

    // const mailList = result.map((row) => row.email).join(',');

    try {
      for (const user of result) {
        const { email, name } = user;
        const MessageToSend = `
      <html>
      <body>
      <h3>Dear ${name},</h3>
      <p></p>
<p>Warm regards, <br/> Bilikis Adesokan <br/> Founder & Team Lead
      <br/> <strong>Serene Scheal Initiative (School Health Program)</strong> <br/>
      ballyunique3568@gmail.com | 09060856551/09060162090.</p>
      </body>
      </html>
      `;

        const mailOption = {
          from: process.env.DB_EU,
          to: email,
          replyTo: process.env.DB_EU,
          subject: subjects,
          html: MessageToSend,
          attachments: [
            {
              filename: pdfFile.originalname,
              path: pdfFile.path,
            },
          ],
        };

        await transporter.sendMail(mailOption);
      }
      res.status(200).json({ message: "Email sent successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Fail to send mail" });
    }
  });
});

//submit mail for newsletter
/**
 * @swagger
 * /newsletter:
 *   post:
 *     summary: Submit mail for newsletter
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *               type: object
 *               properties:
 *                newsMail:
 *                   type: string
 *                   format: email
 *                   example: serene@gmail.com
 *     responses:
 *       200:
 *         description: Inserted successfully
 *       500:
 *         description: Error inserting email
 */
app.post("/newsletter", (req, res) => {
  const { newsMail } = req.body;
  const sql = `SELECT * FROM newsletter WHERE email = ?`;
  db.query(sql, [newsMail], (err, result) => {
    if (err || result.length > 0) {
      return res.status(400).json({ message: "User already exist" });
    }
    const sql2 = `INSERT INTO newsletter(email) VALUES(?)`;
    db.query(sql2, [newsMail], (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Error inserting email" });
      }
      res.status(200).json({ message: "Inserted successfully" });
      console.log("Email inserted");
    });
  });
});

// Register user
/**
* @swagger
* /register:
*   post:
*     summary: Register user into database.
*     requestBody:
*       required: true
*       content: 
*         application/json:
*           schema:
*               type: object
*               properties:
*                 first_name:
*                   type: string
*                   example: Ade
*                 last_name:
*                   type: string
*                   example: Oye
*                 phone_number:
*                   type: string
*                   example: 09000000000
*                 email:
*                   type: string
*                   format: email
*                   example: Serene@gamil.com
*                 password:
*                   type: string
*                   example: password1234
*     responses:
*       200:
*         description: User registerd successfully
*       400:
*         description: User already exist
*       500:
*         description: Error registering user
*/
//Route to register user
app.post("/register", async (req, res) => {
  const { first_name, last_name, phone_number, email, password, role } =
    req.body;
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
      const sql = `INSERT INTO users(first_name, last_name, phone_number, email, password, role) VALUES (?, ?, ?, ?, ?, ?)`;
      db.query(
        sql,
        [first_name, last_name, phone_number, email, hashedPassword, role],
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
/** 
 * @swagger
 * /login:
 *   post:
 *     summary: This to login existing user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: Serene@gmail.com
 *               password:
 *                 type: string
 *                 example: password1234
 *     responses:
 *       200:
 *         description: Login succesful
 *       401:
 *         description: Incorrect password
 *       404:
 *         description: User not found
 *         
*/
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.query(`SELECT * FROM users WHERE email = ?`, [email], (err, result) => {
    if (err || result.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = result[0];
    const isPasCorrect = bcrypt.compareSync(password, user.password);

    if (!isPasCorrect) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    const token = JWT.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    res.status(200).json({ message: "Login succesful" });
  });
});

//Middleware to unthenticate user
const AuthenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  JWT.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

//Create post
/**
 * @swagger
 * /create/posts:
 *   post:
 *     summary: The endpoint to create a blog post
 *     description: >
 *       **NOTE:** Include `withCredentials: true` when making an API call from the frontend.
 *       This is required for the browser to send cookies along with the request.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               image: 
 *                 type: string
 *                 example: https://image.png
 *               title: 
 *                 type: string
 *                 example: The health care
 *               content:
 *                 type: string
 *                 example: Health is the first priority
 *               author:
 *                 type: string
 *                 example: Serene
 *     responses:
 *       200:
 *         description: Post created successfully
 *       500:
 *         description: Error creating post
 */
app.post("/create/posts", AuthenticateToken, (req, res) => {
  const { image, title, content, author } = req.body;
  const userid = req.user.id;
  const sql = `INSERT INTO posts (user_id, image, title, content, author) VALUES (?, ?, ?, ?, ?)`;
  db.query(sql, [userid, image, title, content, author], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Error creating post" });
    }
    res.status(200).json({ message: "Post created successfully" });
  });
});

//Route to fetch all blog post
/**
 * @swagger
 * /blog/pos:
 *   get:
 *     summary: The endpoint to fetch blog posts
 *     responses:
 *       200:
 *         description: Successfully fetched blog posts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   user_id: 
 *                     type: number
 *                     example: 1
 *                   image: 
 *                     type: string
 *                     example: https://image.png
 *                   title:
 *                     type: string
 *                     example: The health care
 *                   content:
 *                     type: string
 *                     example: Health is the first priority
 *                   author:
 *                     type: string
 *                     example: Serene
 *       500:
 *         description: Fail to fetch posts
 */
app.get("/blog/post", (req, res) => {
  const sql = `SELECT * FROM posts`;
  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Fail to fetch post" });
    }
    res.json(result);
  });
});

//Route to display blog detail
/**
 * @swagger
 * /blog/posts/{id}:
 *   get:
 *     summary: Read post details by Params ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the blog post
 *     responses:
 *       200:
 *         description: Successfully retrieved blog post
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: 12345
 *                 image:
 *                   type: string
 *                   example: https://image.png
 *                 title:
 *                   type: string
 *                   example: The health care
 *                 content:
 *                   type: string
 *                   example: Health is the first priority
 *                 author:
 *                   type: string
 *                   example: Serene
 *       404:
 *         description: Post not found
 *       500:
 *         description: Error selecting post
 */
app.get("/post/details/:id", (req, res) => {
  const sql = `SELECT * FROM posts WHERE id = ?`;
  const postid = req.params.id;

  db.query(sql, [postid], (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Error selecting post" });
    }
    if (result.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json(result);
  });
});

//Route to edit blog posts
/**
 * @swagger
 * /edit-blog/{id}:
 *   put:
 *     summary: Edit a blog post by params ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the blog post
 *     responses:
 *       200:
 *         description: Post updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 image:
 *                   type: string
 *                   example: https://image.png
 *                 title:
 *                   type: string
 *                   example: The health care
 *                 content:
 *                   type: string
 *                   example: Health is the first priority
 *                 author:
 *                   type: string
 *                   example: Serene
 *       500:
 *         description: Error updating the post
 */
app.put("/edit-blog/:id", (req, res) => {
  const postId = req.params.id;
  const { image, title, content, author } = req.body;
  const sql = `UPDATE posts SET image = ?, title = ?, content = ?, author =? WHERE id = ?`;
  db.query(sql, [image, title, content, author, postId], (err, result) => {
    if (err) {
      console.error("Error updating post:", err);
      return res.status(500).json("Error updating the post");
    }
    res.status(200).json("Post updated successfully");
  });
});

//Route to delete blog post
/**
 * @swagger
 * /delete-blog/{id}:
 *   delete:
 *     summary: Delete a blog post by params ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the blog post
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *       404:
 *         description: Post not found
 *       500:
 *         description: Server error
 */
app.delete("/delete-blog/:id", (req, res) => {
  const postId = req.params.id;

  const query = "DELETE FROM posts WHERE id = ?";

  db.query(query, [postId], (err, results) => {
    if (err) {
      console.error("Error deleting post:", err);
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(200).json({ message: "Post deleted successfully" });
  });
});

// Route to create event
/**
 * @swagger
 * /create/events:
 *   post:
 *     summary: The endpoint to create a event post
 *     description: >
 *       **NOTE:** Include `withCredentials: true` when making an API call from the frontend.
 *       This is required for the browser to send cookies along with the request.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: 
 *                 type: string
 *                 example: The health care
 *               venue:
 *                 type: string
 *                 example: Central Hospital
 *               description: 
 *                 type: string
 *                 example: The description of the event
 *               author:
 *                 type: string
 *                 example: Serene
 *               image: 
 *                 type: string
 *                 example: https://image.png
 *     responses:
 *        200:
 *          description: Event created successfully
 *        500:
 *          description: Error creating event
 */
app.post("/create/events", AuthenticateToken, (req, res) => {
  const { title, venue, description, author, image } = req.body;
  const userid = req.user.id;
  const sql = `INSERT INTO events (user_id, title, venue, description, author, image) VALUES (?, ?, ?, ?, ?, ?)`;
  db.query(
    sql,
    [userid, title, venue, description, author, image],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Error creating event" });
      }
      res.status(200).json({ message: "Event created successfully" });
    }
  );
});

//Route to fetch events posts
/**
 * @swagger
 * /event/posts:
 *   get:
 *     summary: The endpoint to fetch event post
 *     responses:
 *       200:
 *         description: Successfully fetched event posts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   user_id: 
 *                     type: number
 *                     example: 1
 *                   title: 
 *                     type: string
 *                     example: event titile
 *                   venue: 
 *                     type: string
 *                     example: event venue
 *                   description:
 *                     type: string
 *                     example: event description
 *                   author:
 *                     type: string
 *                     example: Serene
 *                   image:
 *                     type: string
 *                     example: https://image.png
 *       500:
 *         description: Fail to fetch event posts
 */
app.get("/event/posts", (req, res) => {
  const sql = `SELECT * FROM events`;
  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Fail to fetch event posts" });
    }
    res.json(result);
  });
});

//Route to fetch events by id
/**
 * @swagger
 * /event/details/{id}:
 *   get:
 *     summary: Read event details by Params ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the event post
 *     responses:
 *       200:
 *         description: Successfully retrieved event post
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user_id:
 *                   type: string
 *                   example: 12345
 *                 title:
 *                   type: string
 *                   example: The health care
 *                 venue:
 *                   type: string
 *                   example: Health is the first priority
 *                 description:
 *                   type: string
 *                   example: event description
 *                 author:
 *                   type: string
 *                   example: Serene
 *                 image:
 *                   type: string
 *                   example: https://image.png
 *       404:
 *         description: Event not found
 *       500:
 *         description: Error selecting event
 */
app.get("/event/details/:id", (req, res) => {
  const sql = `SELECT * FROM events WHERE id = ?`;
  const postid = req.params.id;

  db.query(sql, [postid], (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Error selecting event" });
    }
    if (result.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(result);
  });
});

//Route to edit event
/**
 * @swagger
 * /edit-event/{id}:
 *   put:
 *     summary: Edit a blog post by params ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the blog post
 *     responses:
 *       200:
 *         description: Event updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                   example: event title
 *                 venue:
 *                   type: string
 *                   example: event venue
 *                 description:
 *                   type: string
 *                   example: event description
 *                 author:
 *                   type: string
 *                   example: Serene
 *                 image:
 *                   type: string
 *                   example: https://image.png
 *       500:
 *         description: Error updating the Event
 */
app.put("/edit-event/:id", (req, res) => {
  const postId = req.params.id;
  const { title, venue, description, author, image } = req.body;
  const sql = `UPDATE events SET title = ?, venue = ?, description = ?, author = ?, image = ? WHERE id = ?`;
  db.query(
    sql,
    [title, venue, description, author, image, postId],
    (err, result) => {
      if (err) {
        console.error("Error updating Event:", err);
        return res.status(500).json("Error updating the Event");
      }
      res.status(200).json("Event updated successfully");
    }
  );
});

//Route to delete event
/**
 * @swagger
 * /delete-event/{id}:
 *   delete:
 *     summary: Delete an event post by params ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the event post
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *       404:
 *         description: Event not found
 *       500:
 *         description: Server error
 */
app.delete("/delete-event/:id", (req, res) => {
  const postId = req.params.id;

  const query = "DELETE FROM events WHERE id = ?";

  db.query(query, [postId], (err, results) => {
    if (err) {
      console.error("Error deleting event:", err);
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Event not found" });
    }
    res.status(200).json({ message: "Event deleted successfully" });
  });
});

//route to logout
/**
 * @swagger
 * /logout:
 *   post:
 *     summary: Log out the current user
 *     description: >
 *       Ends the user session by clearing the authentication cookie or invalidating the token.
 *       **NOTE:** Use `withCredentials: true` on the frontend to ensure the cookie is sent.
 *     responses:
 *       200:
 *         description: User logged out successfully
 */
app.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
  res.status(200).json({ message: "Logout successfully" });
});

app.listen(3002, () => {
  console.log("Server is running on port 3002");
});
