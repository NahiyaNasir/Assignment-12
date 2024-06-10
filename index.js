require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");

const app = express();

const cors = require("cors");
const port = process.env.PORT || 8000;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
// console.log(process.env.PAYMENT_SECRET_KEY)

//   middle ware
app.use(cors());
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "https://assigment-12-client.web.app"],
  })
);
app.get("/", (req, res) => {
  res.send(" bistro boss is running");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gze7wpc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
//    console.log(uri)
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const articleCollection = client.db("newsPaper").collection("article");
    const userCollection = client.db("newsPaper").collection("users");
    const publisherCollection = client.db("newsPaper").collection("publishers");

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection

    //  verify token
    const verifyToken = (req, res, next) => {
      // console.log(req.headers)
      if (!req.headers.authorization) {
        res.status(403).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decode;
        // console.log(decode)
        next();
      });
    };

    //  verify admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req?.decoded?.email;
      // console.log(req?.decoded?.email);
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      // console.log(isAdmin);
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //   for subscribe
    app.post("/subscribe", async (req, res) => {
      const { email, period } = req.body;
      const periods = {
        "1 minute": 1 * 60 * 1000,
        "5 days": 5 * 24 * 60 * 60 * 1000,
        "10 days": 10 * 24 * 60 * 60 * 1000,
      };
      const subscriptionDuration = periods[period];
      const subscriptionEnd = new Date(Date.now() + subscriptionDuration);
      const result = await userCollection.updateOne(
        { email: email },
        { $set: { premiumTaken: subscriptionEnd } }
      );
      // console.log(result);
      res.send(result);
    });
    //   verifying user   premium user
    const checkSubscription = async (req, res, next) => {
      const { email } = req.body;
      // console.log(email);
      try {
        const user = await userCollection
          .collection("users")
          .findOne({ email: email });
        if (user.premiumTaken && new Date() > new Date(user.premiumTaken)) {
          // Subscription expired
          await userCollection
            .collection("users")
            .updateOne({ email: email }, { $set: { premiumTaken: null } });
        }
        next();
      } catch (error) {
        res.status(500).json({ message: "Error checking subscription" });
      }
    };

    // post for jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = await jwt.sign(user, process.env.ACCESS_TOKEN_SECRET);
      // console.log(token)
      res.send({ token });
    });
    //  payment  related api
    app.post("/create-payment-intent", async (req, res) => {
      const { period } = req.body;
      let price = {};
      if (period === "1 minute") {
        price = 10;
      } else if (period === "5 days") {
        price = 25;
      } else if (period === "10 days") {
        price = 35;
      } else {
        return res.status(400).send("Invalid subscription period");
      }

      const amount = price * 100;
      // console.log(amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      // console.log(paymentIntent)
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    //  static
    app.get("/users-static", async (req, res) => {
      const allUser = await userCollection.countDocuments();
      const normalUser = await userCollection.countDocuments({
        premiumTaken: null,
      });
      const premiumUser = await userCollection.countDocuments({
        premiumTaken: { $ne: null },
      });
      res.send({ allUser, normalUser, premiumUser });
    });
    //  post api for add article
    app.post("/add-article", verifyToken, async (req, res) => {
      const addArticle = req.body;
      const result = await articleCollection.insertOne(addArticle);
      res.send(result);
    });

    // get api fot search by article title
    app.get("/all-article-by-search-status-flitter", async (req, res) => {
      const search = req.query.search;
      const status = req.query.status;
      const publisher = req.query.publisher;
      const tags = req.query.tags;
      let query = {};
      if (status) {
        query.status = status;
      }
      //  console.log(status)

      if (search) {
        query.article = { $regex: search, $options: "i" };
      }
      //  console.log(search)
      //  console.log(query)
      if (publisher) {
        query.publisher = publisher;
      }
      if (tags) {
        query.tags = tags;
      }

      //  console.log(query)
      const result = await articleCollection.find(query).toArray();
      res.send(result);
    });

    //   all articles  details by id
    app.get("/all-articles/:id", async (req, res) => {
      const id = req.params.id;
      //  console.log(id)
      const query = { _id: new ObjectId(id) };
      const result = await articleCollection.findOne(query);
      res.send(result);
    });
    //  increase view count
    app.patch("/all-articles/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id)
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $inc: { viewCount: 1 },
      };
      const result = await articleCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //   get premium articles
    app.get("/article-premium", async (req, res) => {
      const status = req.query.status;
      const query = { status: status };
      const result = await articleCollection.find(query).toArray();
      res.send(result);
    });
    //   get articles for current user
    app.get("/my-articles-byEmail", async (req, res) => {
      const author_email = req.query.author_email;
      // console.log(author_email)
      const query = { author_email: author_email };
      // console.log(query)
      const result = await articleCollection.find(query).toArray();
      // console.log(result)
      res.send(result);
    });
    //  delete my articles
    app.delete("/my-articles-delete/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id)
      const query = { _id: new ObjectId(id) };
      // console.log(query)
      const result = await articleCollection.deleteOne(query);
      res.send(result);
    });
    app.patch("/my-articles-update/:id", async (req, res) => {
      const updateItem = req.body;
      const id = req.params.id;
      const flitter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          article: updateItem.article,
          publisher: updateItem.publisher,
          image: updateItem.image,
          description: updateItem.description,
        },
      };
      const result = await articleCollection.updateOne(flitter, updateDoc);
      console.log(result);
      res.send(result);
    });
    //  for pic chart
    app.get("/publication-stats", async (req, res) => {
      const publication = await articleCollection
        .aggregate([
          {
            $group: {
              _id: "$publisher",
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      // console.log(publication)
      res.send(publication);
    });
    //  get api for all-article for admin
    app.get("/add-article", verifyToken, verifyAdmin, async (req, res) => {
      const result = await articleCollection.find().toArray();
      res.send(result);
      // console.log(result)
    });
    //  patch api for make premium article
    app.put(
      "/add-article/:id/premium",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        // console.log(id);
        const filter = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: {
            status: "premium",
          },
        };

        const result = await articleCollection.updateOne(filter, updateDoc);
        res.send(result);
        // console.log(result);
      }
    );
    //  for approved
    app.put(
      "/add-article/:id/approved",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        // console.log(id);
        const filter = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: {
            status: "approved",
          },
        };

        const result = await articleCollection.updateOne(filter, updateDoc);
        res.send(result);
        console.log(result);
      }
    );

    app.put(
      "/add-article/:id/decline",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const reason = req.params.body;
        // console.log(reason);
        const result = await articleCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "declined", declineReason: reason } }
        );
        res.send(result);
        // console.log(result);
      }
    );

    app.put(
      "/add-article/reason",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const reason = req.body.params;
        console.log(reason);
        const result = await articleCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { declineReason: reason } }
        );
        res.send(result);
        // console.log(result);
      }
    );

    //  delete article
    app.delete(
      "/add-article/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        // console.log(id);
        const result = await articleCollection.deleteOne(query);
        res.send(result);
      }
    );
    // get  treading article
    app.get("/trending-article", async (req, res) => {
      const result = await articleCollection
        .find()
        .sort({ viewCount: -1 })
        .limit(6)
        .toArray();
      //  console.log(result)
      res.send(result);
    });
    //   post api for publisher
    app.post("/all-publisher", verifyToken, async (req, res) => {
      const publisher = req.body;
      // console.log(publisher)
      const result = await publisherCollection.insertOne(publisher);
      res.send(result);
    });
    //   get all publisher
    app.get("/all-publisher", async (req, res) => {
      const result = await publisherCollection.find().toArray();
      res.send(result);
    });
    //   users api
    // post users
    app.post("/users", async (req, res) => {
      const user = req.body;
      // console.log(user)
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: " user already exits" });
      }
      user.premiumTaken = null;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //  login
    app.post("/login", checkSubscription, async (req, res) => {
      const email = req.body;
      try {
        const user = await userCollection
          .collection("users")
          .findOne({ email });
        if (!user) {
          return res.status(401).json({ message: "Invalid credentials" });
        }
        res.status(200).json({ message: "Login successful", user });
      } catch (error) {
        res.status(500).json({ message: "Error logging in" });
      }
    });

    //  get users
    app.get("/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      // console.log(result)
      res.send(result);
    });
    // make admin
    app.patch("/users/admin/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      // console.log(id)
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
      // console.log(result)
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req?.decoded?.email) {
        // console.log(req.decoded.email);
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      // console.log(user)
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`newspaper is running at ${port}`);
});

// const type = req.query.type;

// let updateDoc = {};

// if (type === "approved") {
//   updateDoc = {
//     $set: {
//       status: "approved",
//     },
//   };
// } else if (type === "premium") {
//   updateDoc = {
//     $set: {
//       status: "premium",
//     },
//   };
// } else {
//   updateDoc = {
//     $set: {
//       status: "declined",
//     },
//   };
// }
