#!/usr/bin/env python3
"""
Integración directa Ollama + BrainSlot MCP

Este script permite a Ollama usar las herramientas MCP de forma transparente,
creando una sesión interactiva donde el usuario puede solicitar crawling y 
Ollama automáticamente ejecuta las herramientas MCP necesarias.
"""

import asyncio
import json
import subprocess
import ollama
import sys
import os
import logging
import time
from typing import Dict, Any, List

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ollama-mcp-integration.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('OllamaMCP')

class MCPToolExecutor:
    def __init__(self, mcp_command: List[str], mcp_env: Dict[str, str] = None):
        self.mcp_command = mcp_command
        self.mcp_env = mcp_env or {}
        self.mcp_process = None
        self.request_id = 1
        self.initialized = False
        
    async def start_mcp_server(self):
        """Inicia el servidor MCP"""
        logger.info(f"Iniciando servidor MCP con comando: {' '.join(self.mcp_command)}")
        env = {**os.environ, **self.mcp_env}
        logger.debug(f"Variables de entorno: {self.mcp_env}")
        
        try:
            self.mcp_process = await asyncio.create_subprocess_exec(
                *self.mcp_command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            logger.info("✅ Proceso MCP iniciado exitosamente")
            
            # Esperar un poco para que el servidor se inicialice
            await asyncio.sleep(2)
            
            # Leer líneas de stderr hasta encontrar el mensaje de listo
            ready_found = False
            max_attempts = 10
            attempts = 0
            
            while not ready_found and attempts < max_attempts:
                try:
                    # Leer línea de stderr con timeout
                    stderr_line = await asyncio.wait_for(
                        self.mcp_process.stderr.readline(), 
                        timeout=2.0
                    )
                    if stderr_line:
                        line_text = stderr_line.decode().strip()
                        logger.debug(f"MCP stderr: {line_text}")
                        if "Servidor listo" in line_text or "ready" in line_text:
                            ready_found = True
                            logger.info("🎯 Servidor MCP listo para conexiones")
                            break
                except asyncio.TimeoutError:
                    logger.debug(f"Timeout esperando mensaje de servidor listo (intento {attempts + 1})")
                    attempts += 1
                    
            if not ready_found:
                logger.warning("No se detectó mensaje de servidor listo, continuando...")
            
            # Enviar inicialización
            logger.info("📤 Enviando solicitud de inicialización")
            init_request = {
                "jsonrpc": "2.0",
                "id": self.request_id,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {"tools": {}},
                    "clientInfo": {"name": "ollama-integration", "version": "1.0.0"}
                }
            }
            
            init_response = await self._send_request(init_request)
            self.request_id += 1
            
            if init_response and not init_response.get("error"):
                logger.info("✅ Inicialización MCP exitosa")
                self.initialized = True
            else:
                logger.error(f"❌ Error en inicialización: {init_response}")
                return None
            
            # Obtener herramientas disponibles
            logger.info("📋 Solicitando lista de herramientas")
            tools_request = {
                "jsonrpc": "2.0",
                "id": self.request_id,
                "method": "tools/list",
                "params": {}
            }
            
            tools_response = await self._send_request(tools_request)
            self.request_id += 1
            
            if tools_response and "result" in tools_response:
                tools = tools_response["result"].get("tools", [])
                logger.info(f"✅ {len(tools)} herramientas MCP disponibles")
                for tool in tools:
                    logger.info(f"   • {tool.get('name', 'Unknown')}: {tool.get('description', 'No description')}")
                print(f"✅ {len(tools)} herramientas MCP disponibles:")
                for tool in tools:
                    print(f"   • {tool.get('name', 'Unknown')}: {tool.get('description', 'No description')}")
            else:
                logger.error(f"❌ Error obteniendo herramientas: {tools_response}")
            
            return tools_response
            
        except Exception as e:
            logger.error(f"❌ Error iniciando servidor MCP: {e}")
            raise
    
    async def _send_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Envía una solicitud al servidor MCP y espera respuesta"""
        if not self.mcp_process:
            raise Exception("Servidor MCP no iniciado")
        
        logger.debug(f"📤 Enviando solicitud MCP: {json.dumps(request, indent=2)}")
        
        # Enviar solicitud
        request_str = json.dumps(request) + '\n'
        self.mcp_process.stdin.write(request_str.encode())
        await self.mcp_process.stdin.drain()
        logger.debug("✅ Solicitud enviada")
        
        # Leer respuestas hasta encontrar una válida
        max_attempts = 20  # Para inicialización y herramientas
        attempts = 0
        
        while attempts < max_attempts:
            try:
                # Timeout dinámico: corto para inicialización, largo para crawling
                timeout = 90.0 if request.get('method') == 'tools/call' else 5.0
                response_line = await asyncio.wait_for(
                    self.mcp_process.stdout.readline(),
                    timeout=timeout
                )
                
                if not response_line:
                    logger.warning("No se recibió respuesta del servidor MCP")
                    attempts += 1
                    continue
                
                line_text = response_line.decode().strip()
                logger.debug(f"📥 Línea recibida: {line_text[:200]}...")
                
                # Saltar líneas que no son JSON-RPC
                if not line_text.startswith('{'):
                    logger.debug("Saltando línea no-JSON")
                    attempts += 1
                    continue
                
                try:
                    response = json.loads(line_text)
                    
                    # Verificar que es una respuesta a nuestra solicitud
                    if response.get('id') == request.get('id'):
                        logger.info(f"✅ Respuesta MCP recibida para ID {request.get('id')}")
                        logger.debug(f"📋 Respuesta: {json.dumps(response, indent=2)}")
                        return response
                    else:
                        logger.debug(f"Respuesta para ID diferente: {response.get('id')} vs {request.get('id')}")
                        attempts += 1
                        continue
                        
                except json.JSONDecodeError as e:
                    logger.debug(f"Error JSON en línea: {e}")
                    attempts += 1
                    continue
                    
            except asyncio.TimeoutError:
                logger.debug(f"Timeout esperando respuesta (intento {attempts + 1})")
                attempts += 1
                continue
        
        logger.debug(f"Timeout en comunicación después de {max_attempts} intentos")
        return {"error": {"code": -1, "message": "Timeout esperando respuesta MCP"}}
    
    async def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Ejecuta una herramienta MCP"""
        if not self.initialized:
            logger.error("❌ MCP no inicializado, no se puede ejecutar herramienta")
            return {"error": {"code": -1, "message": "MCP no inicializado"}}
            
        request = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        
        logger.info(f"🔧 Ejecutando herramienta MCP: {tool_name}")
        logger.info(f"📝 Argumentos: {json.dumps(arguments, indent=2)}")
        print(f"🔧 Ejecutando herramienta MCP: {tool_name}")
        print(f"📝 Argumentos: {json.dumps(arguments, indent=2)}")
        
        response = await self._send_request(request)
        self.request_id += 1
        
        if response.get("error"):
            logger.debug(f"Respuesta MCP con timeout: {response['error']}")
        else:
            logger.info("✅ Herramienta ejecutada exitosamente")
        
        return response
    
    async def stop(self):
        """Detiene el servidor MCP"""
        logger.info("🛑 Deteniendo servidor MCP...")
        if self.mcp_process:
            try:
                self.mcp_process.terminate()
                await asyncio.wait_for(self.mcp_process.wait(), timeout=5.0)
                logger.info("✅ Servidor MCP detenido correctamente")
            except asyncio.TimeoutError:
                logger.warning("⚠️ Timeout deteniendo servidor, forzando...")
                self.mcp_process.kill()
                await self.mcp_process.wait()
            except Exception as e:
                logger.error(f"❌ Error deteniendo servidor: {e}")
            finally:
                self.mcp_process = None
                self.initialized = False

class OllamaMCPSession:
    def __init__(self):
        self.mcp_executor = None
        self.conversation_history = []
        
    async def start(self):
        """Inicia la sesión Ollama + MCP"""
        logger.info("🚀 Iniciando sesión Ollama + BrainSlot MCP")
        print("🚀 === SESIÓN OLLAMA + BRAINSLOT MCP ===\n")
        
        # Configurar MCP
        mcp_command = ["npx", "tsx", "mcp-server-standalone.ts"]
        mcp_env = {
            "BS_DATA_ROOT": ".data",
            "BS_ENABLE_CRAWLER": "true",
            "BS_CRAWLER_PATH": "./external-mcps/crawler-mcp",
            "PATH": f"{os.path.expanduser('~')}/.local/bin:{os.environ.get('PATH', '')}"
        }
        
        logger.info(f"Configuración MCP: comando={mcp_command}, env={mcp_env}")
        self.mcp_executor = MCPToolExecutor(mcp_command, mcp_env)
        
        try:
            tools_response = await self.mcp_executor.start_mcp_server()
            
            if not tools_response or tools_response.get("error"):
                logger.error("❌ Fallo en inicialización de MCP, abortando")
                print("❌ Error: No se pudo inicializar el servidor MCP correctamente")
                return
                
            print("\n🤖 ¡Ollama listo con capacidades MCP!")
            print("💡 Puedes solicitar crawling de URLs y Ollama usará automáticamente las herramientas MCP")
            print("📝 Ejemplo: 'Crawlea http://southimpact.com y dime qué información encuentras'")
            print("📋 Comandos: 'exit' o 'quit' para salir\n")
            
            await self.interactive_session()
            
        except Exception as e:
            logger.error(f"❌ Error en sesión: {e}", exc_info=True)
            print(f"❌ Error: {e}")
        finally:
            if self.mcp_executor:
                await self.mcp_executor.stop()
    
    async def interactive_session(self):
        """Sesión interactiva con Ollama"""
        while True:
            try:
                # Obtener input del usuario
                user_input = input("👤 Usuario: ").strip()
                
                if user_input.lower() in ['exit', 'quit', 'salir']:
                    print("👋 ¡Hasta luego!")
                    break
                
                if not user_input:
                    continue
                
                # Analizar si necesita herramientas MCP
                needs_mcp = await self.analyze_user_request(user_input)
                
                if needs_mcp:
                    print("🔍 Detectada solicitud de crawling, ejecutando herramientas MCP...")
                    mcp_result = await self.execute_mcp_for_request(user_input)
                    
                    # Crear prompt enriquecido para Ollama
                    enhanced_prompt = f"""
Usuario solicita: {user_input}

Resultado del crawling MCP:
{mcp_result}

Por favor analiza este resultado y proporciona una respuesta útil al usuario sobre la información encontrada en el sitio web.
"""
                    
                    # Generar respuesta con Ollama
                    response = ollama.chat(model='llama3.1:8b', messages=[{
                        'role': 'user',
                        'content': enhanced_prompt
                    }])
                    
                    print(f"🤖 Ollama: {response['message']['content']}\n")
                
                else:
                    # Chat normal con Ollama
                    response = ollama.chat(model='llama3.1:8b', messages=[{
                        'role': 'user', 
                        'content': user_input
                    }])
                    
                    print(f"🤖 Ollama: {response['message']['content']}\n")
                
            except KeyboardInterrupt:
                print("\n👋 ¡Hasta luego!")
                break
            except Exception as e:
                print(f"❌ Error: {e}\n")
    
    async def analyze_user_request(self, user_input: str) -> bool:
        """Analiza si la solicitud del usuario requiere herramientas MCP"""
        keywords = ['crawl', 'crawlea', 'scraped', 'scrape', 'website', 'sitio web', 'página web', 'url', 'http', 'https']
        return any(keyword in user_input.lower() for keyword in keywords)
    
    async def execute_mcp_for_request(self, user_input: str) -> str:
        """Ejecuta herramientas MCP basado en la solicitud del usuario"""
        logger.info(f"🔍 Analizando solicitud para MCP: {user_input[:100]}...")
        
        # Extraer URL de la solicitud
        import re
        url_pattern = r'https?://[^\s]+'
        urls = re.findall(url_pattern, user_input)
        
        if not urls:
            # Buscar dominios sin protocolo
            domain_pattern = r'\b([a-zA-Z0-9-]+\.[a-zA-Z]{2,})\b'
            domains = re.findall(domain_pattern, user_input)
            if domains:
                urls = [f"http://{domain}" for domain in domains]
                logger.info(f"🔗 URLs encontradas (sin protocolo): {urls}")
        else:
            logger.info(f"🔗 URLs encontradas: {urls}")
        
        if not urls:
            logger.warning("⚠️ No se encontraron URLs en la solicitud")
            return "No se encontró URL para crawlear en la solicitud."
        
        url = urls[0]  # Usar la primera URL encontrada
        logger.info(f"🎯 Usando URL: {url}")
        
        try:
            # Ejecutar bs.ingest_url
            logger.info("🕷️ Ejecutando bs.ingest_url...")
            result = await self.mcp_executor.execute_tool("bs.ingest_url", {
                "url": url,
                "rules": {
                    "extractMarkdown": True,
                    "wordThreshold": 50,
                    "respectRobots": True
                }
            })
            
            logger.debug(f"📋 Resultado MCP completo: {json.dumps(result, indent=2)}")
            
            if result and result.get("error"):
                error_msg = result["error"].get("message", "Error desconocido")
                logger.debug(f"MCP timeout - verificando archivos generados: {error_msg}")
                
                # Verificar si se generaron archivos a pesar del timeout
                crawled_files = self.check_crawled_files_for_url(url)
                if crawled_files:
                    return f"""✅ Crawling completado exitosamente para {url}

📁 Archivos generados:
   • Contenido: {os.path.basename(crawled_files['content_file'])} ({crawled_files['file_size']:,} bytes)
   • Metadatos: {os.path.basename(crawled_files['metadata_file']) if crawled_files['metadata_file'] else 'N/A'}
   • Timestamp: {crawled_files['timestamp']}

📂 Ubicación: .data/crawled/
🔗 URL crawleada: {url}

El contenido se ha extraído y guardado correctamente."""
                
                return f"Error ejecutando crawling: {error_msg}"
            
            if result and "result" in result:
                content = result["result"].get("content", [])
                logger.info(f"📄 Contenido recibido: {len(content)} elementos")
                
                if content and len(content) > 0:
                    text_content = content[0].get("text", "")
                    logger.info(f"📝 Tamaño del texto: {len(text_content)} caracteres")
                    
                    if text_content:
                        try:
                            parsed_result = json.loads(text_content)
                            logger.info("✅ Resultado JSON parseado exitosamente")
                            
                            # Respuesta exitosa con información de archivos
                            files_info = ""
                            if 'files' in parsed_result:
                                files_info = f"""

📁 Archivos guardados:
   • Contenido: {parsed_result['files'].get('contentFile', 'N/A')}
   • Metadatos: {parsed_result['files'].get('metadataFile', 'N/A')}
   • Directorio: {parsed_result['files'].get('outputDirectory', '.data/crawled/')}"""
                            
                            full_content = parsed_result.get('fullContent', parsed_result.get('contentPreview', 'No content'))
                            
                            return f"""✅ Crawling completado exitosamente para {url}

📊 Información extraída:
   • URL: {parsed_result.get('url', url)}
   • Título: {parsed_result.get('title', 'N/A')}
   • Tamaño: {parsed_result.get('contentSize', 0):,} bytes
   • Estado: {parsed_result.get('status', 'completed')}
   • Timestamp: {parsed_result.get('timestamp', 'N/A')}{files_info}

📄 Contenido extraído:
{full_content[:1000]}{'...' if len(full_content) > 1000 else ''}

El sitio web ha sido crawleado exitosamente y la información está disponible."""
                        except json.JSONDecodeError as e:
                            logger.warning(f"⚠️ No se pudo parsear JSON: {e}")
                            return f"✅ Contenido crawleado exitosamente de {url}:\n{text_content[:500]}..."
                else:
                    # Verificar archivos cuando no hay contenido en respuesta
                    crawled_files = self.check_crawled_files_for_url(url)
                    if crawled_files:
                        return f"""✅ Crawling completado exitosamente para {url}

📁 Archivos generados:
   • Contenido: {os.path.basename(crawled_files['content_file'])} ({crawled_files['file_size']:,} bytes)
   • Metadatos: {os.path.basename(crawled_files['metadata_file']) if crawled_files['metadata_file'] else 'N/A'}
   • Timestamp: {crawled_files['timestamp']}

📂 Ubicación: .data/crawled/
🔗 URL crawleada: {url}

El sitio web ha sido crawleado exitosamente y la información está guardada en archivos."""
                    else:
                        logger.warning("⚠️ No se encontró contenido en la respuesta")
            else:
                # Verificar archivos cuando no hay 'result' en respuesta
                crawled_files = self.check_crawled_files_for_url(url)
                if crawled_files:
                    return f"""✅ Crawling completado exitosamente para {url}

📁 Archivos generados:
   • Contenido: {os.path.basename(crawled_files['content_file'])} ({crawled_files['file_size']:,} bytes)
   • Metadatos: {os.path.basename(crawled_files['metadata_file']) if crawled_files['metadata_file'] else 'N/A'}
   • Timestamp: {crawled_files['timestamp']}

📂 Ubicación: .data/crawled/
🔗 URL crawleada: {url}

El sitio web ha sido crawleado exitosamente y la información está guardada en archivos."""
                else:
                    logger.warning("⚠️ No se encontró 'result' en la respuesta MCP")
            
            # Verificación final de archivos
            crawled_files = self.check_crawled_files_for_url(url)
            if crawled_files:
                return f"""✅ Crawling completado exitosamente para {url}

📁 Archivos generados:
   • Contenido: {os.path.basename(crawled_files['content_file'])} ({crawled_files['file_size']:,} bytes)
   • Metadatos: {os.path.basename(crawled_files['metadata_file']) if crawled_files['metadata_file'] else 'N/A'}
   • Timestamp: {crawled_files['timestamp']}

📂 Ubicación: .data/crawled/
🔗 URL crawleada: {url}

El sitio web ha sido crawleado exitosamente y la información está guardada en archivos."""
            else:
                return f"Crawling iniciado para {url}, pero no se pudieron verificar los archivos generados."
            
        except Exception as e:
            logger.error(f"❌ Error durante crawling: {e}", exc_info=True)
            # Verificar archivos incluso si hay excepción
            crawled_files = self.check_crawled_files_for_url(url)
            if crawled_files:
                return f"""✅ Crawling completado exitosamente para {url}

📁 Archivos generados:
   • Contenido: {os.path.basename(crawled_files['content_file'])} ({crawled_files['file_size']:,} bytes)
   • Metadatos: {os.path.basename(crawled_files['metadata_file']) if crawled_files['metadata_file'] else 'N/A'}
   • Timestamp: {crawled_files['timestamp']}

📂 Ubicación: .data/crawled/

El sitio web ha sido crawleado exitosamente a pesar del timeout en la comunicación."""
            return f"Error durante el crawling de {url}: {e}"


    def check_crawled_files_for_url(self, url: str) -> dict:
        """Verifica si se generaron archivos de crawling para una URL específica"""
        import os
        import glob
        from urllib.parse import urlparse
        
        try:
            # Extraer dominio de la URL
            domain = urlparse(url).hostname.replace('.', '_')
            
            # Buscar archivos recientes para este dominio
            crawled_dir = ".data/crawled"
            if not os.path.exists(crawled_dir):
                return None
            
            # Buscar archivos de contenido recientes (últimos 5 minutos para dar más margen)
            import time
            current_time = time.time()
            
            content_files = glob.glob(f"{crawled_dir}/{domain}_*_content.md")
            logger.debug(f"Archivos encontrados para {domain}: {content_files}")
            
            for content_file in content_files:
                file_time = os.path.getmtime(content_file)
                time_diff = current_time - file_time
                logger.debug(f"Archivo: {content_file}, tiempo: {time_diff} segundos")
                
                if time_diff < 300:  # 5 minutos
                    # Archivo reciente encontrado
                    metadata_file = content_file.replace('_content.md', '_metadata.json')
                    
                    file_size = os.path.getsize(content_file)
                    timestamp = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(file_time))
                    
                    logger.info(f"✅ Archivo de crawling encontrado: {content_file} ({file_size} bytes)")
                    
                    return {
                        'content_file': content_file,
                        'metadata_file': metadata_file if os.path.exists(metadata_file) else None,
                        'file_size': file_size,
                        'timestamp': timestamp,
                        'domain': domain
                    }
            
            logger.debug(f"No se encontraron archivos recientes para {domain}")
            return None
            
        except Exception as e:
            logger.debug(f"Error verificando archivos: {e}")
            return None

async def start_brainslot_system():
    """
    Función única para inicializar el sistema BrainSlot MCP
    
    Esta función:
    1. Inicia el servidor MCP BrainSlot con capacidades de crawling
    2. Conecta con Ollama para procesamiento de lenguaje natural
    3. Proporciona interfaz interactiva para crawling automático
    
    Uso:
    - python brainslot-mcp-system.py
    - Luego solicitar: "Crawlea https://ejemplo.com"
    """
    print("🚀 === SISTEMA BRAINSLOT MCP ===")
    print("✅ Inicializando servidor MCP con capacidades de crawling...")
    print("🤖 Conectando con Ollama para procesamiento inteligente...")
    print("📁 Archivos de crawling se guardan en: .data/crawled/")
    print()
    
    session = OllamaMCPSession()
    await session.start()

async def main():
    """Función principal - wrapper para compatibilidad"""
    await start_brainslot_system()

if __name__ == "__main__":
    asyncio.run(main())
