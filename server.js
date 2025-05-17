require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { generateLargeCardSet } = require("./aiCardGenerator");
const notificationsApiRoute = require('./api/send-due-notifications');

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("AI Card Generator Backend is running."));

app.post("/api/generate-cards", async (req, res) => {
  try {
    const cardDataString = await generateLargeCardSet(req.body);
    const parsedCards = JSON.parse(cardDataString);
    res.json({ cards: parsedCards });
  } catch (e) {
    console.error("Error in /api/generate-cards:", e);
    if (e instanceof SyntaxError) {
      res.status(500).json({ error: "Failed to parse card data from generation service." });
    } else {
      res.status(500).json({ error: "Failed to generate cards due to an internal server error." });
    }
  }
});

app.use('/api/send-due-notification', notificationsApiRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));