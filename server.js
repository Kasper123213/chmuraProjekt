const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  // respond with JSON
  res.json({ message: "Hello Kasper" });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
