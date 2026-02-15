"use client";

import { useSecurity } from "@/lib/hooks/useSecurity";
import { JWTSettings } from "@/components/security/JWTSettings";
import { APIKeyManager } from "@/components/security/APIKeyManager";
import { IPFilterList } from "@/components/security/IPFilterList";
import { JWTConfig, SecurityConfig, APIKey } from "@/types/gateway";
import { Shield, Key, Filter } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SecurityPage() {
  const { jwtConfig, securityConfig, isLoading, updateSecurity, isUpdating } = useSecurity();

  const handleJWTUpdate = (updates: Partial<JWTConfig>) => {
    updateSecurity({ jwt: updates });
  };

  const handleAPIKeyAdd = (keyId: string, apiKey: APIKey) => {
    const currentKeys = securityConfig?.api_keys || {};
    updateSecurity({
      security: {
        ...securityConfig,
        api_keys: {
          ...currentKeys,
          [keyId]: apiKey,
        },
      },
    });
  };

  const handleAPIKeyDelete = (keyId: string) => {
    const currentKeys = securityConfig?.api_keys || {};
    const { [keyId]: removed, ...remainingKeys } = currentKeys;
    updateSecurity({
      security: {
        ...securityConfig,
        api_keys: remainingKeys,
      },
    });
  };

  const handleIPFilterUpdate = (whitelist: string[], blacklist: string[]) => {
    updateSecurity({
      security: {
        ...securityConfig,
        ip_whitelist: whitelist,
        ip_blacklist: blacklist,
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Security Settings</h1>
        <p className="text-muted-foreground">
          Configure authentication, API keys, and IP filtering for your gateway
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading security configuration...</div>
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <Tabs defaultValue="jwt" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="jwt" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              JWT Authentication
            </TabsTrigger>
            <TabsTrigger value="apikeys" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="ipfilter" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              IP Filtering
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jwt" className="mt-6">
            <JWTSettings
              config={jwtConfig}
              onSave={handleJWTUpdate}
              isLoading={isUpdating}
            />
          </TabsContent>

          <TabsContent value="apikeys" className="mt-6">
            <APIKeyManager
              apiKeys={securityConfig?.api_keys}
              onAdd={handleAPIKeyAdd}
              onDelete={handleAPIKeyDelete}
              isLoading={isUpdating}
            />
          </TabsContent>

          <TabsContent value="ipfilter" className="mt-6">
            <IPFilterList
              whitelist={securityConfig?.ip_whitelist}
              blacklist={securityConfig?.ip_blacklist}
              onUpdate={handleIPFilterUpdate}
              isLoading={isUpdating}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
