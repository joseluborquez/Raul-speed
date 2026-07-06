export interface CrearPagoInput {
  pedidoId: string;
  totalClp: number;
  returnBaseUrl: string;
}

export interface CrearPagoResultado {
  redirectUrl: string;
  proveedorRef: string;
}
