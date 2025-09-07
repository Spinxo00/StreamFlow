const express = require('express'); const app = express(); 
// This will serve static files from the 'public' directory 
// and automatically set the correct MIME types based on file extensions. 
app.use(express.static('public'));

app.listen(3000, () => 
  { console.log('Server listening on port 3000'); });
