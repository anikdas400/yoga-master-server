const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
const jwt = require("jsonwebtoken")
const port = process.env.PORT || 5000;


// midleware
app.use(cors());
app.use(express.json())

// verify token
const verifyJWT = (req,res,next)=>{
  const authorization = req.headers.authorization;
  if( !authorization ){
    return res.status(401).send({message: 'invalid authorization'})
  }
  const token = authorization?.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
    if(err){
      return res.status(403).send({message: 'Forbidden access'})
    }
    req.decoded = decoded;
    next();
  })
}

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

    // ...........Users Routes..........

    // ......jwt token ......
    // token generate
    app.post("/api/set-token",async(req,res)=>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{expiresIn: '24h'});
      res.send({token})
    })

    // middleware for admin and instructor

    // verifyAdmin
    const verifyAdmin = async(req,res,next)=>{
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      if(user.role === 'admin'){
        next();
      }else{
        return res.status(401).send({message: 'unauthorized access'})
      }
    }

    // verifyInstructor
    const verifyInstructor = async(req,res,next)=>{
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      if(user.role === 'instructor'){
        next();
      }else{
        return res.status(401).send({message: 'unauthorized access'})
      }
    }


    // add new-user in db
    app.post('/new-user', async(req,res)=>{
      const newUser = req.body;
      const result = await userCollection.insertOne(newUser);
      res.send(result)
    });

    // get users
    app.get('/users', async(req,res)=>{
      const result = await userCollection.find({}).toArray();
      res.send(result);
    });

    // get users by id
    app.get('/users/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // get users by email
    app.get('/users/:email',verifyJWT, async(req,res)=>{
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // delete user
    app.delete('/delete-user/:id',verifyJWT,verifyAdmin, async(req,res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id)};
      const result = await userCollection.deleteOne(query);
      res.send(result)
    });

    // update user
    app.put('/update-user/:id',verifyJWT,verifyAdmin, async(req,res)=>{
      const id =req.params.id;
      const updatedUser = req.body;
      const filter = {_id: new ObjectId(id)};
      const options = { upsert: true};
      const updateDoc = {
        $set:{
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.option,
          address: updatedUser.address,
          about: updatedUser.about,
          photoUrl: updatedUser.photoUrl,
          skills: updatedUser.skills ? updatedUser.skills : null,
        }
      }
      const result = await userCollection.updateOne(filter,updateDoc,options);
      res.send(result)
    });

    // ...........CLASSES ROUTES ...........

    // add new-class in database

    app.post('/new-class',verifyJWT,verifyInstructor, async (req, res) => {
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

    app.get('/classes/:email',verifyJWT,verifyInstructor, async (req, res) => {
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

    app.patch('/change-status/:id',verifyJWT,verifyAdmin, async (req, res) => {
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

    app.put('/update-class/:id',verifyJWT,verifyInstructor, async (req, res) => {
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

    app.get('/cart-item/:id',verifyJWT, async (req, res) => {
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

    app.get('/cart/:email',verifyJWT, async (req, res) => {
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

    app.delete('/delete-cart-item/:id',verifyJWT, async (req, res) => {
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

    app.post('/payment-info',verifyJWT, async(req,res)=>{
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



    // .......Enrollment Routes.......



    app.get("/popular_classes", async(req,res)=>{
      const result = await classCollection.find().sort({totalEnrolled: -1}).limit(6).toArray();
      res.send(result)
    });

    // get with instructors

    app.get("/popular-instructors", async(req,res)=>{
      const pipeline =[
        {
          $group:{
            _id:"$instructorEmail",
            totalEnrolled:{$sum: "$totalEnrolled"}
          }
        },
        {
          $lookup:{
            from: "users",
            localField: "_id",
            foreignField: "email",
            as:"instructor"
          }
        },
        {
          $project:{
            _id: 0,
            instructor:["$instructor",0]
          },
          totalEnrolled: 1
        },
        {
          $sort:{
            totalEnrolled: -1
          }
        },
        {
          $limit:6
        }
      ];

      const result = await classCollection.aggregate(pipeline).toArray();
      res.send(result);
    });

    // .......Admin Routes........

    // admin status

    app.get('/admin-status',verifyJWT,verifyAdmin, async(req,res)=>{
      const approvedClasses = (await classCollection.find({status: "approved"}).toArray()).length;
      const pendingClasses = (await classCollection.find({status: "pending"}).toArray()).length;
      const instructors = (await userCollection.find().toArray()).length;
      const totalClasses = (await classCollection.find().toArray()).length;
      const totalEnrolled = (await enrolledCollection.find().toArray()).length;

      const result = { approvedClasses,pendingClasses,instructors,totalClasses,totalEnrolled}

      res.send(result);
    });

    // get all instructor

    app.get('/instructors', async(req,res)=>{
      const result = await userCollection.find({role: "instructor"}).toArray();
      res.send(result)
    });

    // get enrolled classes dy email

    app.get('/enrolled-classes/:email',verifyJWT,async(req,res)=>{
      const email = req.params.email;
      const query = {userEmail: email};
      const pipeline = [
        {
          $match: query
        },
        {
          $lookup:{
            from : "classes",
            localField: "classesId",
            foreignField: "_id",
            as: "classes"
          }
        },
        {
          $unwind: "$classes"
        },
        {
          $lookup:{
            from : "users",
            localField: "classes.instructorEmail",
            foreignField: "email",
            as: "instructor"
          }
        },
        {
          $project:{
            _id: 0 ,
            instructor: {
              $arrayElemAt:["$instructor",0]
            },
            classes: 1
          }
        }
      ];

      const result = await enrolledCollection.aggregate(pipeline).toArray();
      res.send(result);
    });

    // applied for instructor

    app.post('/as-instructor', async(req,res)=>{
      const data = req.body;
      const result = await appliedCollection.insertOne(data);
      res.send(result)
    });

    // get applied-instructor by email

    app.get('/applied-instructors/:email', async(req,res)=>{
      const email = req.params.email;
      const result = await appliedCollection.findOne({email})
      res.send(result)
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