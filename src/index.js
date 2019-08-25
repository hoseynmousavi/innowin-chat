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

wss.on("connection", (ws, req) => {
  const userId = req.url.split("/?id=")[1]
  const prevUser = arr[userId] ? {...arr[userId]} : {}
  arr[userId] = {...prevUser, ws}
  ws.on("close", () => arr[userId].ws = null)
})

app.route("/sendMessage")
    .post((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*")
      const data = {...req.body}
      const {receiver} = data
      if (receiver && arr[receiver] && arr[receiver].ws) {
        arr[receiver].ws.send(JSON.stringify(data))
        res.send({state: 1, message: "message sent to the user"})
      }
      else if (arr[receiver] && arr[receiver].token) {
        arr[receiver].token && webpush.sendNotification(arr[receiver].token, JSON.stringify({
          title: "پیام رسان اینوین",
          body: data.text,
          icon: "https://innowin.ir/icon-192x192.png",
        })).catch(err => console.error(err))
        res.send({state: -2, message: "user is not online"})
      }
      else {
        res.send({state: -1, message: "user is not online & wasn't"})
      }
    })

app.route("/")
    .get((req, res) => {
      res.send("Hello Babes!")
    })

app.route("/subscribe")
    .post((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*")
      const {subscription, userId} = req.body
      if (arr[userId]) arr[userId].token = subscription
      res.sendStatus(200)
    })