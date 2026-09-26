package services

func PointInPolygon(lat, lng float64, p [][]float64) bool {
	if len(p) < 3 {
		return false
	}
	in := false
	j := len(p) - 1
	for i := range p {
		yi, xi := p[i][0], p[i][1]
		yj, xj := p[j][0], p[j][1]
		if ((yi > lat) != (yj > lat)) && (lng < (xj-xi)*(lat-yi)/(yj-yi)+xi) {
			in = !in
		}
		j = i
	}
	return in
}
