import express, { json } from 'express';
import cors from 'cors'
import {MongoClient } from 'mongodb';
import joi from 'joi';
import dotenv from 'dotenv';

dotenv.config()

const app = express();
app.use(json());
app.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI)
let db;
mongoClient.connect(()=> {
    db = mongoClient.db('batepapo-uol-api');
})


const participantSchema = joi.object({
    name: joi.string().required()
})

const messageSchema = joi.object({
    from: joi.string().required().custom( async (value, helper)=>{
        const lala = await db.collection('participants').findOne({name: value})
        if(lala){
            return true;
        }
        return helper.message("User not found")
    }),
    to: joi.string().required(),
    text: joi.string().required(),
    type:joi.any().allow("message","private_message")

})

app.post('/participants',async (req,res)=>{

    const validation = participantSchema.validate(req.body,{abortEarly: false})
    const nameConflict = await db.collection('participants').findOne({name: req.body.name})
    
    if(validation.error){
        res.status(422).send(validation.error.details.map((item)=>item.message))
        return;
    
    }
    if(nameConflict){
        res.sendStatus(409);
        return;
    }
    try{
        const participant = {...req.body, lastStatus: Date.now()}
        await db.collection('participants').insertOne(participant);
        res.sendStatus(201);
    }catch(err){
      console.log(err);
      res.sendStatus(500);  
    }
})

app.get('/participants', async (req,res)=>{

    try{
        const participants = await db.collection('participants').find().toArray();
        res.send(participants);
    }catch(err){
        console.log(err)
        res.sendStatus(500)
    }
})

app.post('/messages', async (req,res)=>{
    const message = {...req.body, from: req.headers.user}
    const validation = messageSchema.validate(message)
    if(validation.error){
        console.log(validation.error.details.map((item)=>item.message))
        res.status(422).send(validation.error.details.map((item)=>item.message))
        return;
    }
  
})


app.listen(5000);