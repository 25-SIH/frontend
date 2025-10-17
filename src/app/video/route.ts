export async function GET(): Promise<Response> {
  return new Response(null, { 
    status: 302, 
    headers: { Location: "https://youtu.be/9rUN9aCqbJg" } 
  });
}