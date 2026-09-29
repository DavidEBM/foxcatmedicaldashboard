import {
  adminErrorResponse,
  getAdminAuth,
  getAdminFirestore,
  requireAdmin,
} from "@/services/firebase/admin-server-auth";

type AuthUserSummary = {
  uid: string;
  email?: string;
  displayName?: string;
};

async function listAllAuthUsers(): Promise<AuthUserSummary[]> {
  const auth = getAdminAuth();
  const users: AuthUserSummary[] = [];
  let pageToken: string | undefined;

  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(
      ...page.users.map((user) => ({
        uid: user.uid,
        email: user.email || undefined,
        displayName: user.displayName || undefined,
      })),
    );
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const [profileSnapshot, authUsers] = await Promise.all([
      getAdminFirestore().collection("users").get(),
      listAllAuthUsers(),
    ]);

    const authByUid = new Map(
      authUsers.map((user) => [user.uid, user]),
    );
    const profileByUid = new Map(
      profileSnapshot.docs.map((profile) => [profile.id, profile]),
    );
    const userIds = new Set([
      ...profileByUid.keys(),
      ...authByUid.keys(),
    ]);

    const users = Array.from(userIds).map((uid) => {
      const profileDocument = profileByUid.get(uid);
      const profile = profileDocument?.data() || {};
      const authUser = authByUid.get(uid);

      return {
        id: uid,
        uid,
        email: authUser?.email || profile.email || undefined,
        displayName:
          profile.displayName || authUser?.displayName || "",
        role: profile.role || "patient",
        // Una identidad de Firebase sin users/{uid} no tiene permisos en la app.
        // Se muestra como inactiva hasta que exista un perfil válido.
        status: profileDocument
          ? profile.status || "active"
          : "inactive",
        createdAt: profile.createdAt || undefined,
      };
    });

    return Response.json({ users });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
