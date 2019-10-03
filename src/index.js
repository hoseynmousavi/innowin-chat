import express from "express"
import cors from "cors"
import bodyParser from "body-parser"
import WebSocket from "ws"
import webpush from "web-push"

const app = express()
app.use(cors())
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())

webpush.setGCMAPIKey("AIzaSyCs3A46ckvbZwZCgFVBkWys_woOoSMFMbI")
webpush.setVapidDetails(
    "mailto:hoseyn.mousavi78@gmail.com",
    "BPAnD6orqwKDMUaBB-pHlnh3FwgcEBzrJPdGarY-oyOaHglrxPGSaYETOMn-dfvvIL0HgN6HDUqVi016081bP5k",
    "Z4reUR3PPwJDIRYxUVMNeNzRBrgW5jl9bKruQSOxqdg",
)

const wss = new WebSocket.Server({server: app.listen(5000)})

let arr = {}

wss.on("connection", (ws, req) =>
{
    const parseDetail = req.url.split("/?id=")[1].split("&unique=")
    const userId = parseDetail[0]
    const unique = parseDetail[1]
    arr[userId] = {...arr[userId], [unique]: {ws}}
    ws.on("message", (message) =>
    {
        console.log("received: ", message)
        ws.send(JSON.stringify({message: new Date().toISOString(), kind: "ping"}))
    })
    ws.on("close", () => arr[userId][unique] && arr[userId][unique].token ? arr[userId][unique].ws = null : delete arr[userId][unique])
})

app.route("/sendMessage")
    .post((req, res) =>
    {
        res.setHeader("Access-Control-Allow-Origin", "*")
        const data = {...req.body, kind: "chat"}
        const {receiver, sender} = data
        if (receiver && arr[receiver])
        {
            let tokens = {}
            Object.values(arr[receiver]).forEach(socket =>
            {
                if (socket.ws)
                {
                    socket.ws.send(JSON.stringify(data))
                    if (socket.token) tokens[socket.token.keys.auth] = true
                }
                else if (socket.token && tokens[socket.token.keys.auth] !== true)
                {
                    tokens[socket.token.keys.auth] = true
                    webpush.sendNotification(socket.token, JSON.stringify({title: "پیام رسان اینوین", body: data.text, icon: "https://innowin.ir/icon-192x192.png"})).catch(err => console.error(err))
                }
            })
            res.send({state: 1, message: "message sent to the user"})
        }
        else res.send({state: -1, message: "user is not online & wasn't"})

        if (sender && arr[sender]) Object.values(arr[sender]).forEach(socket => socket.ws && socket.ws.send(JSON.stringify(data)))
    })

app.route("/sendNotif")
    .post((req, res) =>
    {
        res.setHeader("Access-Control-Allow-Origin", "*")
        const data = {...req.body, kind: "notification"}
        const {id} = data
        if (id && arr[id])
        {
            Object.values(arr[id]).forEach(socket => socket.ws && socket.ws.send(JSON.stringify(data)))
            res.send({state: 1, message: "notif sent to the user"})
        }
        else res.send({state: -1, message: "user is not online & wasn't"})
    })

app.route("/sendPost")
    .post((req, res) =>
    {
        res.setHeader("Access-Control-Allow-Origin", "*")
        const data = {...req.body, kind: "post"}
        Object.values(arr).forEach(user => Object.values(user).forEach(socket => socket.ws && socket.ws.send(JSON.stringify(data))))
        res.send({state: 1, message: "post sent to all users"})
    })

app.route("/")
    .get((req, res) =>
    {
        res.send("Hello Babes!")
    })

app.route("/subscribe")
    .post((req, res) =>
    {
        res.setHeader("Access-Control-Allow-Origin", "*")
        const {subscription, userId, unique} = req.body
        if (arr[userId] && arr[userId][unique]) arr[userId][unique].token = subscription
        res.sendStatus(200)
    })