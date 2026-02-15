"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { APIKey } from "@/types/gateway";
import { Key, Plus, Trash2, Copy, Check } from "lucide-react";

interface APIKeyManagerProps {
  apiKeys: Record<string, APIKey> | undefined;
  onAdd: (keyId: string, apiKey: APIKey) => void;
  onDelete: (keyId: string) => void;
  isLoading?: boolean;
}

export function APIKeyManager({ apiKeys, onAdd, onDelete, isLoading }: APIKeyManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    keyId: "",
    name: "",
    permissions: "",
    rateLimitRequests: "",
    rateLimitWindow: "",
  });

  const handleAddKey = () => {
    if (!formData.keyId || !formData.name) {
      return;
    }

    // Generate a random API key
    const generatedKey = generateAPIKey();

    const newAPIKey: APIKey = {
      name: formData.name,
      key: generatedKey,
      permissions: formData.permissions
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
    };

    // Add rate limit if specified
    if (formData.rateLimitRequests && formData.rateLimitWindow) {
      newAPIKey.rate_limit = {
        requests: parseInt(formData.rateLimitRequests),
        window: parseInt(formData.rateLimitWindow),
      };
    }

    onAdd(formData.keyId, newAPIKey);
    setIsAddDialogOpen(false);
    resetForm();

    // Auto-copy the generated key
    copyToClipboard(generatedKey);
  };

  const handleDeleteClick = (keyId: string) => {
    setDeletingKeyId(keyId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deletingKeyId) {
      onDelete(deletingKeyId);
    }
    setIsDeleteDialogOpen(false);
    setDeletingKeyId(null);
  };

  const resetForm = () => {
    setFormData({
      keyId: "",
      name: "",
      permissions: "",
      rateLimitRequests: "",
      rateLimitWindow: "",
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const generateAPIKey = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let key = "gw_";
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const apiKeyEntries = apiKeys ? Object.entries(apiKeys) : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API Key Management</CardTitle>
            <CardDescription>
              Manage API keys for programmatic access to the gateway
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add API Key
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {apiKeyEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Key className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No API keys configured</p>
            <Button onClick={() => setIsAddDialogOpen(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First API Key
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>API Key</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Rate Limit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeyEntries.map(([keyId, apiKey]) => (
                <TableRow key={keyId}>
                  <TableCell className="font-mono text-sm">{keyId}</TableCell>
                  <TableCell>{apiKey.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {apiKey.key.substring(0, 12)}...
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(apiKey.key)}
                      >
                        {copiedKey === apiKey.key ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {apiKey.permissions.length > 0 ? (
                        apiKey.permissions.map((perm) => (
                          <Badge key={perm} variant="outline" className="text-xs">
                            {perm}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {apiKey.rate_limit ? (
                      <span className="text-xs">
                        {apiKey.rate_limit.requests} req/{apiKey.rate_limit.window}s
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No limit</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(keyId)}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Add API Key Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New API Key</DialogTitle>
              <DialogDescription>
                Create a new API key for programmatic access. The key will be generated
                automatically and shown only once.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="keyId">Key ID *</Label>
                <Input
                  id="keyId"
                  placeholder="e.g., prod-service-1"
                  value={formData.keyId}
                  onChange={(e) => setFormData({ ...formData, keyId: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier for this API key
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Production Service API Key"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="permissions">Permissions</Label>
                <Input
                  id="permissions"
                  placeholder="e.g., read, write, admin (comma-separated)"
                  value={formData.permissions}
                  onChange={(e) => setFormData({ ...formData, permissions: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of permissions
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rateLimitRequests">Rate Limit (requests)</Label>
                  <Input
                    id="rateLimitRequests"
                    type="number"
                    placeholder="e.g., 1000"
                    value={formData.rateLimitRequests}
                    onChange={(e) =>
                      setFormData({ ...formData, rateLimitRequests: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rateLimitWindow">Window (seconds)</Label>
                  <Input
                    id="rateLimitWindow"
                    type="number"
                    placeholder="e.g., 3600"
                    value={formData.rateLimitWindow}
                    onChange={(e) =>
                      setFormData({ ...formData, rateLimitWindow: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddKey}
                disabled={!formData.keyId || !formData.name || isLoading}
              >
                <Key className="h-4 w-4 mr-2" />
                Generate API Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete API Key</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the API key{" "}
                <strong>{deletingKeyId}</strong>? This action cannot be undone and will
                immediately revoke access for any services using this key.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isLoading}>
                Delete Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
