const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const ioFile = require("socketio-file-upload");
const fs = require("fs");
const url = require('url');

// Enable CORS
app.use((req, res, next) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Pass to next layer of middleware
  next();
});

app.use(express.static(__dirname + "/public"));

app.get("/", function (request, response) {
  response.sendFile(__dirname + "/public/home.html");
});

app.get("/:name",(req,res)=>{
    uniqueKey = req.params.name;
    var toSendData = "";
    let runPyDecode = new Promise((resolve, reject) => {
      const {spawn} = require('child_process');
      const childProcess=spawn('python', ['./Steganography/decode.py',"ImageBuffer/" + uniqueKey + ".png" ]);  
      childProcess.stdout.on('data',(data)=>{
        resolve(data);
      });
      childProcess.stderr.on('data', (data) => {
        console.log("err",data.toString());
        reject(data);
      });
    })
    runPyDecode.then((data)=>{
        toSend = data.toString();
        res.send({data:toSend});
    }).catch(err => console.log(err)); 
})

// Checking if the users connect
io.on("connection", (socket) => {
  console.log("A user connected");
  // Checking if the users disconnect
  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });

  socket.on("message", (message) => {
    console.log("message", message);
    // Broadcasting this message to all the users that are connected
    io.emit("message", message);
  });

  const fileUpload = new ioFile();

  fileUpload.listen(socket);

  fileUpload.on("start", (fileInfo) => {
    console.log(`File upload started: ${fileInfo.name}`);
  });

  fileUpload.on("saved", (fileInfo) => {
    console.log(`File saved: ${fileInfo.name}`);
  });

  fileUpload.on("error", (err) => {
    console.log(`Error while uploading file: ${err}`);
  });

  socket.on('base64 file', (fileInfo) => {
    if(fileInfo.flag == 1){
      const buffer = Buffer.from(fileInfo.data.split(',')[1], 'base64');
      io.emit('base64 file', fileInfo);
    }
    else{ 
      const buffer = Buffer.from(fileInfo.imageData.split(',')[1], 'base64');
      
      let runPyEncode = new Promise((resolve, reject) => {
        const {spawn} = require('child_process');
        const childProcess=spawn('python', ['./Steganography/encode.py',fileInfo.textData,"ImageBuffer/" + fileInfo.imageName,fileInfo.uniqueKey]);
        childProcess.stdout.on('data',(data)=>{
          resolve(data);
        });
        childProcess.stderr.on('data', (data) => {
          console.log("err",data.toString());
          reject(data);
        });
      })


      // Save the file to disk or do whatever you want with the data
      fs.writeFile("./Steganography/ImageBuffer/" + fileInfo.imageName, buffer, (err) => {
        if (err) {
          console.log(`Error while saving file: ${err}`);
        } else {
          runPyEncode.then((data)=>{
            var mime = 'image/png'; 
            var encoding = 'base64'; 
            var data = fs.readFileSync('./Steganography/ImageBuffer/encrypted_img'+fileInfo.uniqueKey+'.png').toString(encoding); 
            var uri = 'data:' + mime + ';' + encoding + ',' + data; 
            fileInfo.imageData = uri;
            io.emit('base64 file', fileInfo);
          }).catch(err => console.log(err)); 
        }
     });

    }
  });
});





const hostname = "172.20.10.2"; // change this to your LAN IP address
const port = 5500;
http.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
