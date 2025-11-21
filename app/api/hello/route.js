export function GET(request) {
  return new Response(
    JSON.stringify({
      message: "Hello from Azure Next.js API!",
      time: new Date().toISOString()
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
}
