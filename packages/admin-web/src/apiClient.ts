// Browser-native client for apps/api's admin surface — unlike packages/shared's ApiClient (built
// for an Electron main process with no cookie jar of its own), this runs in a real browser, so
// withCredentials lets the browser handle the admin_token cookie session natively. apps/api's
// CORS is scoped to exactly this app's origin (see apps/api/internal/router/routes.go).
import axios from "axios";
import type { BackendCompany, CreateCompanyInput } from "@unghosted/shared";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
  withCredentials: true,
  Headers: { "ngrok-skip-browser-warning": "true" },
  
});

export async function adminLogin(
  email: string,
  password: string,
): Promise<void> {
  await http.post("/v1/admin/logIn", { Email: email, Password: password });
}

export async function createCompany(input: CreateCompanyInput): Promise<void> {
  await http.post("/v1/companies/create", {
    Name: input.name,
    OwnerName: input.ownerName,
    OwnerEmail: input.ownerEmail,
    OwnerPassword: input.ownerPassword,
  });
}

export async function listCompanies(): Promise<BackendCompany[]> {
  const res = await http.get("/v1/companies/list");
  return res.data ?? [];
}

export async function increaseBalance(
  id: number,
  value: number,
): Promise<void> {
  await http.patch("/v1/companies/increaseBalance", { Id: id, Value: value });
}

export async function reduceBalance(id: number, value: number): Promise<void> {
  await http.patch("/v1/companies/reduceBalance", { Id: id, Value: value });
}
