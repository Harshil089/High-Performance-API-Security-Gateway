"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { JWTConfig } from "@/types/gateway";
import { Eye, EyeOff, Save } from "lucide-react";

interface JWTSettingsProps {
  config: JWTConfig | undefined;
  onSave: (config: Partial<JWTConfig>) => void;
  isLoading?: boolean;
}

export function JWTSettings({ config, onSave, isLoading }: JWTSettingsProps) {
  const [formData, setFormData] = useState<Partial<JWTConfig>>({
    algorithm: "HS256",
    secret: "",
    issuer: "",
    audience: "",
    access_token_expiry: 3600,
    refresh_token_expiry: 604800,
    public_key_file: "",
    private_key_file: "",
  });

  const [showSecret, setShowSecret] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        algorithm: config.algorithm || "HS256",
        secret: config.secret || "",
        issuer: config.issuer || "",
        audience: config.audience || "",
        access_token_expiry: config.access_token_expiry || 3600,
        refresh_token_expiry: config.refresh_token_expiry || 604800,
        public_key_file: config.public_key_file || "",
        private_key_file: config.private_key_file || "",
      });
    }
  }, [config]);

  const handleChange = (field: keyof JWTConfig, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setHasChanges(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>JWT Authentication</CardTitle>
            <CardDescription>
              Configure JSON Web Token settings for authentication
            </CardDescription>
          </div>
          <Badge variant={formData.algorithm === "RS256" ? "default" : "secondary"}>
            {formData.algorithm}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Algorithm Selection */}
          <div className="space-y-2">
            <Label htmlFor="algorithm">Algorithm</Label>
            <Select
              value={formData.algorithm}
              onValueChange={(value) => handleChange("algorithm", value as "HS256" | "RS256")}
            >
              <SelectTrigger id="algorithm">
                <SelectValue placeholder="Select algorithm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HS256">HS256 (HMAC with SHA-256)</SelectItem>
                <SelectItem value="RS256">RS256 (RSA with SHA-256)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              HS256 uses symmetric keys, RS256 uses asymmetric (public/private) keys
            </p>
          </div>

          {/* Secret (for HS256) */}
          {formData.algorithm === "HS256" && (
            <div className="space-y-2">
              <Label htmlFor="secret">Secret Key</Label>
              <div className="relative">
                <Input
                  id="secret"
                  type={showSecret ? "text" : "password"}
                  value={formData.secret}
                  onChange={(e) => handleChange("secret", e.target.value)}
                  placeholder="Enter secret key"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Shared secret for signing and verifying tokens
              </p>
            </div>
          )}

          {/* Key Files (for RS256) */}
          {formData.algorithm === "RS256" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="private_key_file">Private Key File Path</Label>
                <Input
                  id="private_key_file"
                  type="text"
                  value={formData.private_key_file}
                  onChange={(e) => handleChange("private_key_file", e.target.value)}
                  placeholder="/path/to/private.key"
                />
                <p className="text-xs text-muted-foreground">
                  Path to RSA private key for signing tokens
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="public_key_file">Public Key File Path</Label>
                <Input
                  id="public_key_file"
                  type="text"
                  value={formData.public_key_file}
                  onChange={(e) => handleChange("public_key_file", e.target.value)}
                  placeholder="/path/to/public.key"
                />
                <p className="text-xs text-muted-foreground">
                  Path to RSA public key for verifying tokens
                </p>
              </div>
            </>
          )}

          {/* Issuer */}
          <div className="space-y-2">
            <Label htmlFor="issuer">Issuer</Label>
            <Input
              id="issuer"
              type="text"
              value={formData.issuer}
              onChange={(e) => handleChange("issuer", e.target.value)}
              placeholder="api-gateway"
            />
            <p className="text-xs text-muted-foreground">
              Identifies the principal that issued the JWT
            </p>
          </div>

          {/* Audience */}
          <div className="space-y-2">
            <Label htmlFor="audience">Audience</Label>
            <Input
              id="audience"
              type="text"
              value={formData.audience}
              onChange={(e) => handleChange("audience", e.target.value)}
              placeholder="api-clients"
            />
            <p className="text-xs text-muted-foreground">
              Identifies the recipients that the JWT is intended for
            </p>
          </div>

          {/* Token Expiry */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="access_token_expiry">Access Token Expiry (seconds)</Label>
              <Input
                id="access_token_expiry"
                type="number"
                min="60"
                max="86400"
                value={formData.access_token_expiry}
                onChange={(e) => handleChange("access_token_expiry", parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                {formData.access_token_expiry && formData.access_token_expiry >= 60
                  ? `${Math.floor((formData.access_token_expiry as number) / 60)} minutes`
                  : "Invalid"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refresh_token_expiry">Refresh Token Expiry (seconds)</Label>
              <Input
                id="refresh_token_expiry"
                type="number"
                min="3600"
                max="2592000"
                value={formData.refresh_token_expiry}
                onChange={(e) => handleChange("refresh_token_expiry", parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                {formData.refresh_token_expiry && formData.refresh_token_expiry >= 3600
                  ? `${Math.floor((formData.refresh_token_expiry as number) / 86400)} days`
                  : "Invalid"}
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={isLoading || !hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? "Saving..." : "Save JWT Settings"}
            </Button>
            {hasChanges && (
              <span className="text-sm text-muted-foreground">
                You have unsaved changes
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
