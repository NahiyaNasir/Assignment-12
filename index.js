const express = require("express");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();

const cors = require("cors");
const port = process.env.PORT || 8000;

//   middle ware
app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
  res.send(" bistro boss is running");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { status } = require("init");
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
      console.log(req?.decoded?.email);
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      // console.log(isAdmin);
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // post for jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = await jwt.sign(user, process.env.ACCESS_TOKEN_SECRET);
      // console.log(token)
      res.send({ token });
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
    app.get("/article-premium",async(req,res)=>{
          const    status = req.query.status;
          const query={status:status}
          const result=await articleCollection.find(query).toArray()
          res.send(result)
    })
    //   get articles for current user
    app.get('/my-articles/:email',async(req,res)=>{
      const email=req.query.email
      const query={email:email}
      const result=await articleCollection.findOne(query)
      res.send(result)
    })

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
        console.log(id);
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
        console.log(id);
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
        const reason = req.query.body;
        console.log(reason);
        const result = await articleCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "declined", declineReason: reason } }
        );
        res.send(result);
        console.log(result);
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
        console.log(id);
        const result = await articleCollection.deleteOne(query);
        res.send(result);
      }
    );
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
      const result = await userCollection.insertOne(user);
      res.send(result);
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
