package companies

type NotReadyCompany struct {
	Name  string `json:"Name"`
	Owner string `json:"Owner"`
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
