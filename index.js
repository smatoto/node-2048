const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
const port = 8080;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Hello Express app');
});

app.listen(port, () => console.log(`Listening at port ${port}`));
