const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
const port = 8080;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Node 2048 App');
});

app.listen(port, () => console.log(`Listening at port ${port}`));
