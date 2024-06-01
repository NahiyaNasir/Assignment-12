const express = require("express");
require("dotenv").config();
const app = express();

const cors = require("cors");
const port = process.env.PORT || 5000;

//   middle ware
app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
  res.send(" bistro boss is running");
});

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri =
  `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gze7wpc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
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

    const articleCollection= client.db('newsPaper').collection('article')
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    //  post api for add article
     app.post("/add-article",async(req,res)=>{
      const addArticle=req.body
      const result=await articleCollection.insertOne(addArticle)
      res.send(result)
     })
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
