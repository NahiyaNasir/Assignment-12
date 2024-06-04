const express = require("express");
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
    const userCollection=client.db('newsPaper').collection('users')
    const publisherCollection=client.db('newsPaper').collection('publishers')
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection


    //  post api for add article
     app.post("/add-article",async(req,res)=>{
      const addArticle=req.body
      const result=await articleCollection.insertOne(addArticle)
      res.send(result)
     })

    //   post api for publisher
     app.post("/all-publisher",async(req,res)=>{
      const publisher=req.body
      // console.log(publisher)
      const result=await publisherCollection.insertOne(publisher)
      res.send(result)
     })
    //   get all publisher
    app.get("/all-publisher",async(req,res)=>{
       const result= await publisherCollection.find().toArray()
       res.send(result)
    })
    //   users api
    // post users
     app.post('/users',async(req,res)=>{
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
      app.get('/users',async(req,res)=>{
        const result=await userCollection.find().toArray()
        // console.log(result)
        res.send(result)
      })
      // make admin 
        app.patch("/users/admin/:id",async (req,res)=>{
          const id=req.params.id
          // console.log(id)
          const filter= {_id: new ObjectId(id)}
           const updateDoc={
            $set:{
              role:'admin'
            }
           }
            const result= await userCollection.updateOne(filter,updateDoc)
            res.send(result)
            // console.log(result)
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
