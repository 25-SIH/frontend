export async function GET(): Promise<Response> {
  return new Response(null, { 
    status: 302, 
    headers: { Location: "https://youtu.be/XaY6dB7m1yM" } 
  });
}