const app = require("./app");
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log('\n=== Server Started ===');
  console.log(`🚀 Server running on port ${port}`);
  console.log('\n📍 Available endpoints:');
  console.log(`   ├─ API:           http://localhost:${port}`);
  console.log(`   └─ Documentation: http://localhost:${port}/api-docs`);
  console.log('\n💡 Press Ctrl+C to stop the server');
  console.log('=======================\n');
});
