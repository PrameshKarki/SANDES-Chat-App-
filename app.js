//Import modules
const http=require("http");
const path=require("path");

const express=require("express");
const dotenv=require("dotenv");
const socket=require("socket.io");
const ejs=require("ejs");
const bodyParser=require("body-parser");
const mongoose=require("mongoose");
const session=require("express-session");
const mongoDBStore=require("connect-mongodb-session")(session);
const flash=require("connect-flash");

//Import routers
const authRoutes=require("./routes/authRoutes");
const appRoutes=require("./routes/appRoutes");

//Import format message
const formatMessage=require("./utils/formatMessage");
//Import user related utils
const user=require("./utils/user");


//Load config
dotenv.config({path:"./config/config.env"});

//Instantiate express app
const app=express();

//Create server
const server=http.createServer(app);

//Serve static files
app.use(express.static(path.join(__dirname,"public")));

//Set view engine
app.set("view engine","ejs");
app.set("views","views");

//Set Store Variable
const store=new mongoDBStore({
    uri:process.env.MONGODB_URI,
    collections:"Sessions"
})

//Set Session
app.use(session({
secret:"Gautam buddha was born in nepal",
resave:false,
saveUninitialized:false,
store:store,
}))

//Set flash
app.use(flash());

//Set body parser
app.use(bodyParser.urlencoded({extended:false}));

//Use routes
app.use(authRoutes);
app.use(appRoutes);

//Instantiate socket
const io=socket(server);

io.on("connection",(socket)=>{

    socket.on("joinRoom",currentUser=>{
    //Store information in database 
    user.joinUser(socket.id,currentUser).then(()=>{
        //Join user to room
        socket.join(currentUser.room.name);
        
        //Welcome current user
        //Generates user-status event on->Greet,new user join and remove
        socket.emit("user-status",formatMessage("Bot",`Hello ${currentUser.firstName},Welcome to ${currentUser.room.name}.`));
        
        //Broadcast message to all the user
        socket.broadcast.to(currentUser.room.name).emit("user-status",formatMessage("Bot",`${currentUser.firstName} joined the room.`));
    }).catch(err=>{
        console.log(err);
    })
    })

    //Receive chat message from the client
    socket.on("chatMessage",async (message)=>{
        const currentUser=await user.fetchUser(socket.id);
        const currentRoom=await user.fetchRoom(socket.id);
        let icon=`${currentUser.firstName[0]}${currentUser.lastName[0]}`
        io.to(currentRoom.name).emit("message",{id:currentUser._id,...formatMessage(currentUser.firstName,message),icon});

    })

    //Broadcast message to the all user when user disconnect
    socket.on("disconnect",async()=>{
        const currentUser=await user.fetchUser(socket.id);
        const currentRoom=await user.fetchRoom(socket.id);
        user.disconnectUser(socket.id).then(()=>{
            io.to(currentRoom.name).emit("user-status",formatMessage("User",`${currentUser.firstName} left the room.`));
        }).catch(err=>{
            console.log(err);
        });
        
        
    })
})

mongoose.connect(process.env.MONGODB_URI,{
    useUnifiedTopology:true,
    useNewUrlParser:true,
    useCreateIndex:true
}).then(()=>{
    //Listen server
    server.listen(process.env.PORT || 5000);
}).catch(err=>{
    console.error(err);
})


