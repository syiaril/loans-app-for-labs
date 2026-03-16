const http = require('http');

const data = JSON.stringify({ guestName: 'Test Server', guestDescription: '', guestDepartment: '' });

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/guest-register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  console.log(`STATUS: ${res.statusCode}`);
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('BODY:', body.substring(0, 500) + '...'));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
