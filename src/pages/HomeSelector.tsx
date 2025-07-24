import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const HomeSelector: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              Escolha o sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Button
              className="w-full py-6 text-lg"
              onClick={() => navigate("/reembolso")}
            >
              Sistema de Reembolso
            </Button>
            <Button
              className="w-full py-6 text-lg"
              variant="outline"
              onClick={() => navigate("/compras")}
            >
              Sistema de Pedido de Compras
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HomeSelector; 