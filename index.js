const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
const port = process.env.PORT || 5000;


// midleware
app.use(cors());
app.use(express.json())

// mongodb connection

const { MongoClient, ServerApiVersion, ObjectId, } = require('mongodb');
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

    // ...........CLASSES ROUTES ...........

    // add new-class in database

    app.post('/new-class', async (req, res) => {
      const newClass = req.body;
      // newClass.availableSeats = parseInt(newClass.availableSeats);
      const result = await classCollection.insertOne(newClass)
      res.send(result)

    });

    // get all classes

    app.get('/classes', async (req, res) => {
      const query = { status: "approved" }
      const result = await classCollection.find().toArray();
      res.send(result)
    });

    // get classes by instructor email address

    app.get('/classes/:email', async (req, res) => {
      const email = req.params.email;
      const query = { instructorEmail: email };
      const result = await classCollection.find(query).toArray();
      res.send(result)
    });

    // manage classes

    app.get('/manage-classes', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result)
    });

    // update classes status and reason

    app.patch('/change-status/:id', async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const reason = req.body.reason;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: status,
          reason: reason,
        },
      };;
      const result = await classCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    // get approved classes

    app.get('/approved-classes', async (req, res) => {
      const query = { status: "approved" };
      const result = await classCollection.find(query).toArray();
      res.send(result)
    });

    // get signle class details

    app.get('/class/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query);
      res.send(result)
    });

    // update class details (all data)

    app.put('/update-class/:id', async (req, res) => {
      const id = req.params.id;
      const updateClass = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          name: updateClass.name,
          description: updateClass.description,
          price: updateClass.price,
          availableSeats: parseInt(updateClass.availableSeats),
          image: updateClass.image,
          videoLink: updateClass.videoLink,
          status: "pending"
        }
      };
      const result = await classCollection.updateOne(filter, updateDoc, options);
      res.send(result)
    });



    // ...........CARTS ROUTES.........

    // add-to-cart in database

    app.post('/add-to-cart', async (req, res) => {
      const newCartItem = req.body;
      const result = await cartCollection.insertOne(newCartItem);
      res.send(result)
    });

    // get cartItem by id

    app.get('/add-to-cart/:id', async (req, res) => {
      const id = req.params.id;
      const email = req.body.email;
      const query = {
        classId: id,
        userMail: email
      }

      const options = {
        projection: { classId: 1 },
      };
      const result = await cartCollection.findOne(query, options);
      res.send(result)


    });

    // cart info by user email

    app.get('/cart/:email', async (req, res) => {
      const email = req.params.email;
      const query = { userMail: email };
      const projection = { classId: 1 };
      const carts = await cartCollection.find(query, { projection: projection });
      const classIds = carts.map((cart) => new ObjectId(cart.classIds));
      const query2 = { _id: { $in: classIds } };
      const result = await classCollection.find(query2).toArray();
      res.send(result);
    });

    // delete cart item

    app.delete('/delete-cart-item/:id', async (req, res) => {
      const id = req.params.id;
      const query = { classId: id };
      const result = await cartCollection.deleteOne(query);
      res.send(result)
    });

    // ...........PAYMENT ROUTES...........

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price) * 100

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"]
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });

    });

    // post payment info to db

    app.post('/payment-info', async(req,res)=>{
      const paymentInfo = req.body;
      const classesId = paymentInfo.classesId;
      const userEmail = paymentInfo.userEmail;
      const signleClassId = req.query.classId;

      let query;
      if(signleClassId){
        query = {classId: signleClassId, userMail: userEmail};
      }
      else{
        query = {classId:{$in: classesId}};
      }

      const classesQuery = {_id:{$in: classesId.map(id => new ObjectId(id))}};
      const classes = await classCollection.find(classesQuery).toArray();
      const newEnrolledData = {
        userEmail: userEmail,
        classId: signleClassId.map(id=> new ObjectId(id)),
        trasnsactionId: paymentInfo.trasnsactionId
      };

      const updatedDoc ={
        $set:{
          totalEnrolled: classes.reduce((total,current)=> total + current.totalEnrolled , 0)+ 1 || 0,
          availableSeats: classes.reduce((total,current)=> total + current.availableSeats , 0)- 1 || 0
        }
     
      };

      const updatedResult = await classCollection.updateMany(classesQuery,updatedDoc,{upsert: true});
      const enrolledResult = await enrolledCollection.insertOne(newEnrolledData);
      const deletedResult = await cartCollection.deleteMany(query);
      const paymentResult = await paymentCollection.insertOne(paymentInfo);

      res.send({paymentResult,deletedResult,enrolledResult,updatedResult})

    });

    // get payment history

    app.get("/payment-history/:email", async(req,res)=>{
      const email = req.params.email;
      const query ={userEmail: email};
      const result = await paymentCollection.find(query).sort({date: -1}).toArray();
      res.send(result)
    });

    // get payment history length

    app.get("/payment-history-length/:email", async(req,res)=>{
      const email = req.params.email;
      const query ={userEmail: email};
      const total = await paymentCollection.countDocuments(query);
      res.send({total});
    });


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