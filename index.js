import express, { json } from 'express';
import cors from 'cors'
import { MongoClient } from 'mongodb';
import joi from 'joi';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
import { stripHtml } from 'string-strip-html'

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
    to: joi.string().required(),
    text: joi.string().required(),
    type:joi.any().allow("message","private_message")

})

setInterval(removeInactiveUsers,15000);

async function removeInactiveUsers(){
    
    const usersInactives = await db.collection('participants').find({lastStatus:{$lt: Date.now()-10000}}).toArray()
    
    await db.collection('participants').deleteMany({lastStatus:{$lt: (Date.now()-10000)}})
    
    usersInactives.forEach( async (user)=>{
        db.collection("messages").insertOne({
            from: user.name,
            to: 'Todos',
            text: 'sai da sala...',
            type: 'status', 
            time: dayjs().format('HH:MM:ss')
        })
    })

}
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
        const participant = {
            name: stripHtml(req.body.name).result.trim(), 
            lastStatus: Date.now()
        }
        
        await db.collection('participants').insertOne(participant);
        await db.collection("messages").insertOne({
            from: req.body.name,
            to: 'Todos', 
            text: 'entra na sala...', 
            type: 'status', 
            time: dayjs().format('HH:MM:ss')
        })
        
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
    
    const validation = messageSchema.validate(req.body,{abortEarly: false})
    const userVerify = await db.collection('participants').findOne({name: req.headers.user})
    
    if(validation.error){
        res.status(422).send(validation.error.details.map((item)=>item.message))
        return;
    }
    
    if(!userVerify){
        res.status(422).send("User Disconnected, please reload page.")
        return;
    }
    
    try {
        const message = {
            ...req.body,
            text: stripHtml(req.body.text).result.trim(),
            from: req.headers.user,
            time:dayjs().format('HH:MM:ss')
        }

        await db.collection('messages').insertOne(message);
        res.sendStatus(201)

    }catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

app.get('/messages', async (req,res)=>{
    const limitMessages = req.query.limit
    const user = req.headers.user
    try{
        const messages = await db.collection('messages').find(
            {
                $or:[
                {from: user},
                {type:"message"},
                {type:"status"},
                {to: user, type: "private_message"}
                ]
            }
        ).toArray();

        res.send(messages.slice(-limitMessages));

    }catch(err){
        console.log(err)
        res.sendStatus(500)
    }
})

app.post('/status', async (req,res)=>{
    
    const user = req.headers.user;
    const userVerify = await db.collection('participants').findOne({name: stripHtml(user).result})
    
    if(!userVerify){
        res.sendStatus(404);
        return;
    }
    
    try{
        await db.collection('participants').updateOne({name: user},{$set: {lastStatus: Date.now()}})
        res.sendStatus(200);
    
    }catch(err){
        console.log(err)
        res.sendStatus(500)
    }
})

app.listen(5000);