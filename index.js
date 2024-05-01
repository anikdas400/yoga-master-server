const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000;


// midleware
app.use(cors());
app.use(express.json())

// mongodb connection

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@yoga-master.tp08lqq.mongodb.net/?retryWrites=true&w=majority&appName=yoga-master`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // create a database and collection
    const database = client.db("yoga-master");
    const userCollection = database.collection("users");
    const classCollection = database.collection("classes");
    const cartCollection = database.collection("carts");
    const paymentCollection = database.collection("payments");
    const enrolledCollection = database.collection("enrolled");
    const appliedCollection = database.collection("applied");

    // CLASSES ROUTE HERE
    
    app.post('/new-class',async(req,res)=>{
      const newClass = req.body;
      // newClass.availableSeats = parseInt(newClass.availableSeats);
      const result = await classCollection.insertOne(newClass)
      res.send(result)

    });

    // get all classes

    app.get('/classes', async(req,res)=>{
      const query = { status:"approved" }
      const result = await classCollection.find().toArray();
      res.send(result)
    });

    // get classes by instructor email address

    app.get('/classes/:email', async(req,res)=>{
      const email = req.params.email ;
      const query = {instructorEmail: email};
      const result = await classCollection.find(query).toArray();
      res.send(result)
    });

    // manage classes

    app.get('/manage-classes', async(req,res)=>{
      const result = await classCollection.find().toArray();
      res.send(result)
    });

    // update classes status and reason

    app.patch('/change-status/:id',async(req,res)=>{
      const id = req.params.id;
      const status = req.body.status;
      const reason = req.body.reason;
      const filter = {_id: new ObjectId(id)};
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: status,
          reason: reason,
        },
      };;
      const result = await classCollection.updateOne(filter,updateDoc,options);
      res.send(result);
    });

    // get approved classes

    app.get('/approved-classes', async(req,res)=>{
      const query = { status:"approved" };
      const result = await classCollection.find(query).toArray();
      res.send(result)
    });

    // get signle class details

    app.get('/class/:id', async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await classCollection.findOne(query);
      res.send(result)
    })

    // update class details (all data)

    app.put('/update-class/:id', async(req,res)=>{
      const id = req.params.id;
      const updateClass = req.body;
      const filter ={_id: new ObjectId(id)};
      const options = { upsert : true};
      const updateDoc ={
        $set:{
          name: updateClass.name,
          description: updateClass.description,
          price : updateClass.price,
          availableSeats: parseInt(updateClass.availableSeats),
          image: updateClass.image,
          videoLink: updateClass.videoLink,
          status: "pending"
        }
      };
      const result = await classCollection.updateOne(filter,updateDoc,options);
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Hello Developers 2025!')
})

app.listen(port, () => {
  console.log(`Yoga-Master listening on port ${port}`)
})