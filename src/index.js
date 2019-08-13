import express from "express"
import bodyParser from "body-parser"
import WebSocket from "ws"

const app = express()
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())


const wss = new WebSocket.Server({port: 5005})

let arr = {}

wss.on("connection", (ws, req) =>
{
    const userId = req.url.split("/?id=")[1]
    arr[userId] = ws
    ws.on("close", () => delete arr[userId])
})

app.route("/sendMessage")
    .post((req, res) =>
    {
        res.setHeader("Access-Control-Allow-Origin", "*")
        const data = {...req.body}
        const {receiver} = data
        if (receiver && arr[receiver])
        {
            arr[receiver].send(JSON.stringify(data))
            res.send({state: 1, message: "message sent to the user"})
        }
        else res.send({state: -1, message: "user is not online"})
    })

app.route("/")
    .get((req, res) =>
    {
        res.send("Hello Babes!")
    })

app.listen(5000, () => console.log(`Innowin Chat is Now Running on Port 5000`))
