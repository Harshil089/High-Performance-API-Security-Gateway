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
import { Plus, Trash2, Shield, ShieldAlert } from "lucide-react";

interface IPFilterListProps {
  whitelist: string[] | undefined;
  blacklist: string[] | undefined;
  onUpdate: (whitelist: string[], blacklist: string[]) => void;
  isLoading?: boolean;
}

export function IPFilterList({ whitelist, blacklist, onUpdate, isLoading }: IPFilterListProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<"whitelist" | "blacklist">("whitelist");
  const [ipAddress, setIpAddress] = useState("");
  const [deletingIP, setDeletingIP] = useState<{ ip: string; type: "whitelist" | "blacklist" } | null>(null);

  const handleAddIP = () => {
    if (!ipAddress.trim()) {
      return;
    }

    // Basic IP/CIDR validation
    if (!isValidIPOrCIDR(ipAddress.trim())) {
      alert("Please enter a valid IP address or CIDR notation (e.g., 192.168.1.1 or 10.0.0.0/24)");
      return;
    }

    const currentWhitelist = whitelist || [];
    const currentBlacklist = blacklist || [];

    if (filterType === "whitelist") {
      if (currentWhitelist.includes(ipAddress.trim())) {
        alert("This IP is already in the whitelist");
        return;
      }
      onUpdate([...currentWhitelist, ipAddress.trim()], currentBlacklist);
    } else {
      if (currentBlacklist.includes(ipAddress.trim())) {
        alert("This IP is already in the blacklist");
        return;
      }
      onUpdate(currentWhitelist, [...currentBlacklist, ipAddress.trim()]);
    }

    setIsAddDialogOpen(false);
    setIpAddress("");
  };

  const handleDeleteClick = (ip: string, type: "whitelist" | "blacklist") => {
    setDeletingIP({ ip, type });
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deletingIP) return;

    const currentWhitelist = whitelist || [];
    const currentBlacklist = blacklist || [];

    if (deletingIP.type === "whitelist") {
      onUpdate(
        currentWhitelist.filter((ip) => ip !== deletingIP.ip),
        currentBlacklist
      );
    } else {
      onUpdate(
        currentWhitelist,
        currentBlacklist.filter((ip) => ip !== deletingIP.ip)
      );
    }

    setIsDeleteDialogOpen(false);
    setDeletingIP(null);
  };

  const isValidIPOrCIDR = (value: string): boolean => {
    // Basic validation for IPv4 and CIDR
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$/;

    return ipv4Regex.test(value) || ipv6Regex.test(value);
  };

  const whitelistArray = whitelist || [];
  const blacklistArray = blacklist || [];

  return (
    <div className="space-y-6">
      {/* IP Whitelist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              <div>
                <CardTitle>IP Whitelist</CardTitle>
                <CardDescription>
                  Allow access only from these IP addresses
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={() => {
                setFilterType("whitelist");
                setIsAddDialogOpen(true);
              }}
              size="sm"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add IP
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {whitelistArray.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-2">No IPs in whitelist</p>
              <p className="text-xs">
                When empty, all IPs are allowed (unless blacklisted)
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP Address / CIDR</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {whitelistArray.map((ip) => (
                  <TableRow key={ip}>
                    <TableCell className="font-mono">{ip}</TableCell>
                    <TableCell>
                      <Badge variant="success" className="bg-green-500/10 text-green-600 border-green-500/20">
                        Allowed
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(ip, "whitelist")}
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
        </CardContent>
      </Card>

      {/* IP Blacklist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              <div>
                <CardTitle>IP Blacklist</CardTitle>
                <CardDescription>
                  Block access from these IP addresses
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={() => {
                setFilterType("blacklist");
                setIsAddDialogOpen(true);
              }}
              size="sm"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add IP
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {blacklistArray.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-2">No IPs in blacklist</p>
              <p className="text-xs">
                No IPs are explicitly blocked
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP Address / CIDR</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blacklistArray.map((ip) => (
                  <TableRow key={ip}>
                    <TableCell className="font-mono">{ip}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">Blocked</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(ip, "blacklist")}
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
        </CardContent>
      </Card>

      {/* Add IP Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add IP to {filterType === "whitelist" ? "Whitelist" : "Blacklist"}
            </DialogTitle>
            <DialogDescription>
              Enter an IP address or CIDR notation to{" "}
              {filterType === "whitelist" ? "allow" : "block"} access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ipAddress">IP Address / CIDR</Label>
              <Input
                id="ipAddress"
                placeholder="e.g., 192.168.1.1 or 10.0.0.0/24"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Examples: 192.168.1.1 (single IP), 10.0.0.0/24 (CIDR range), ::1 (IPv6)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddIP}
              disabled={!ipAddress.trim() || isLoading}
              variant={filterType === "whitelist" ? "default" : "destructive"}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to {filterType === "whitelist" ? "Whitelist" : "Blacklist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove IP Address</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{deletingIP?.ip}</strong> from the{" "}
              {deletingIP?.type}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isLoading}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
