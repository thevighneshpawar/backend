// require('dotenv').config({path:'/env'})

import dotenv from "dotenv"
import connectDB from "./db/index.js";
// when using db always use try catch and async await to avoid errors

dotenv.config({
        path:'./env'
})

connectDB()










/*
import express from "express"

const app =express()


( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error",(err)=>{
            console.log("ERRRR",err);
            throw error  
        })
        app.listen(process.env.PORT ,()=>{
            console.log(`http://${process.env.port}`);  
        })

    } catch (error) {
        console.error("Error:",err)
        throw err
    }
})()
    */