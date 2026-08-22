package companies

type NotReadyCompany struct {
	Name  string `json:"Name"`
	Owner string `json:"Owner"`
}

// CreateCompanyRequest is what an admin submits to POST /v1/companies/create — it both
// describes the company and provisions its owner's login account (companies have no
// credential of their own; the owner's `users` row, tagged with CompanyRole, is the login).
type CreateCompanyRequest struct {
	Name          string `json:"Name"`
	OwnerName     string `json:"OwnerName"`
	OwnerEmail    string `json:"OwnerEmail"`
	OwnerPassword string `json:"OwnerPassword"`
}
type CompanyWithoutId struct {
	Name    string   `json:"Name"`
	Owner   string   `json:"Owner"`
	Admins  []string `json:"Admins"`
	Hrs     []string `json:"Hrs"`
	Balance int      `json:"Balance"`
}

type Company struct {
	Id      int      `json:"Id"`
	Name    string   `json:"Name"`
	Owner   string   `json:"Owner"`
	Admins  []string `json:"Admins"`
	Hrs     []string `json:"Hrs"`
	Balance int      `json:"Balance"`
}

type IdWithValue struct {
	Id    int `json:"Id"`
	Value int `json:"Value"`
}

type IdWithName struct {
	Id   int    `json:"Id"`
	Name string `json:"Name"`
}

type OnlyName struct {
	Name string `json:"Name"`
}
