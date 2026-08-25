// Thin wrapper around apps/api's real routes (confirmed against the Go handlers directly,
// not docs/REST.md, which is stale in places — see ROADMAP.md's connectivity-phase notes).
// Runs from each app's Electron main process (not the renderer) so it isn't subject to the
// backend's missing CORS config — see CLAUDE.md's network-layer notes.
//
// Known backend issue (not fixed here yet, by design — see ROADMAP.md): LogInData.Password and
// NotReadyUser.Password are tagged `json:"-"` server-side, which drops the password on decode.
// login()/sendCode() below send the field apps/api expects today; they'll keep 401ing/silently
// mis-storing passwords until that tag is fixed on the backend.

import axios, { type AxiosInstance } from "axios";

export type RoomJoinStatus = "none" | "requested" | "accepted" | "rejected";

export interface BackendRoom {
  id: string;
  created_by: string | null;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  join_code: string;
  candidate_name: string;
  role: string;
  status: "scheduled" | "active" | "ended";
  join_status: RoomJoinStatus;
  requested_by?: string | null;
  company_id?: number | null;
}

export interface CreateRoomInput {
  candidateName: string;
  role: string;
  createdBy: string;
}

export interface LoginResult {
  accessToken: string;
}

// Matches apps/api's companies/model.go Company struct's own JSON tags exactly (PascalCase —
// that package's convention, not BackendRoom's snake_case; reflects the real wire shape).
export interface BackendCompany {
  Id: number;
  Name: string;
  Owner: string;
  Admins: string[];
  Hrs: string[];
  Balance: number;
}

export interface CreateCompanyInput {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}

export class ApiClient {
  private http: AxiosInstance;
  private refreshCookie?: string;

  constructor(baseUrl: string) {
    this.http = axios.create({
      baseURL: baseUrl,
      withCredentials: true,
      Headers: {'ngrok-skip-browser-warning': 'true'},
    });
  }

  async sendCode(name: string, email: string, password: string): Promise<void> {
    await this.http.post("/v1/users/sendCode", {
      Name: name,
      Email: email,
      Password: password,
    });
  }

  async register(email: string, code: number): Promise<void> {
    await this.http.post("/v1/users/register", { Email: email, Code: code });
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const res = await this.http.post("/v1/users/login", {
      Email: email,
      Password: password,
    });
    // axios/Node has no cookie jar of its own — capture the httpOnly refresh_token
    // cookie manually so refresh() can resend it.
    const setCookie = res.headers["set-cookie"];
    if (setCookie?.length) this.refreshCookie = setCookie[0];
    return { accessToken: res.data.access_token };
  }

  async refresh(): Promise<string> {
    if (!this.refreshCookie)
      throw new Error("No refresh cookie captured — call login() first");
    const res = await this.http.post("/v1/auth/refresh", null, {
      headers: { Cookie: this.refreshCookie },
    });
    return res.data.access_token;
  }

  async createRoom(
    token: string,
    input: CreateRoomInput,
  ): Promise<BackendRoom> {
    const res = await this.http.post(
      "/v1/room/create",
      {
        candidate_name: input.candidateName,
        role: input.role,
        created_by: input.createdBy,
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return res.data;
  }

  async listRooms(token: string): Promise<BackendRoom[]> {
    const res = await this.http.get("/v1/room/list", {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Go returns a nil slice (JSON null) when there are no rooms yet.
    return res.data ?? [];
  }

  async getRoom(token: string, roomId: string): Promise<BackendRoom> {
    const res = await this.http.get(`/v1/room/${roomId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }

  async requestJoin(token: string, roomId: string): Promise<BackendRoom> {
    const res = await this.http.post(`/v1/room/${roomId}/request-join`, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }

  async acceptJoin(token: string, roomId: string): Promise<BackendRoom> {
    const res = await this.http.post(`/v1/room/${roomId}/accept-join`, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }

  async rejectJoin(token: string, roomId: string): Promise<BackendRoom> {
    const res = await this.http.post(`/v1/room/${roomId}/reject-join`, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }

  async endRoom(token: string, roomId: string): Promise<BackendRoom> {
    const res = await this.http.post(`/v1/room/${roomId}/end`, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }
}
