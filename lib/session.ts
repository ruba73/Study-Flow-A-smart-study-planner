import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export async function getSessionUserId() {
  const session = await getServerSession(authOptions);
  const userId = session?.user && "id" in session.user ? String(session.user.id) : null;
  return userId;
}
