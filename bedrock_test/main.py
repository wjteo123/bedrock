import os
from typing import List, Dict
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agno.agent import Agent
from agno.team import Team
from agno.models.aws import AwsBedrock
from agno.tools.serper import SerperTools
from agno.tools.reasoning import ReasoningTools
from agno.tools.python import PythonTools
from agno.tools.file import FileTools
from agno.tools.file_generation import FileGenerationTools
from agno.db.mongo import MongoDb 
from agno.knowledge.knowledge import Knowledge  
from agno.vectordb.qdrant import Qdrant 
from agno.knowledge.embedder.aws_bedrock import AwsBedrockEmbedder  
import asyncio
import json

load_dotenv()

class QueryRequest(BaseModel):
    query: str

app = FastAPI(title="Agno AI Agent System API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"],  
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],  
)

class AgnoAISystem:
    """
    AI Agent System using Agno Framework with AWS Bedrock
    - Using your proven working configuration from legal_ai
    - Now with Qdrant for knowledge integration and Amazon Titan Text Embeddings V2
    - Extended with FileGenerationTools for generating files
    - Exposed via FastAPI for custom UI integration
    """
    
    def __init__(self):
        self.setup_models()
        self.setup_db()
        self.setup_knowledge()
        self.agents = self._initialize_agents()
        self.team = self._create_agent_team()
        
    def setup_models(self):
        """Initialize AWS Bedrock models using your working config"""
        print("🚀 Setting up Agno AI System with AWS Bedrock...")
        
        self.BASE_MODEL = AwsBedrock(
            id=os.getenv("AWS_BEDROCK_MODEL", "openai.gpt-oss-120b-1:0"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            aws_region=os.getenv("AWS_REGION", "us-west-2")
        )
        
        print("✅ Models initialized successfully with your proven legal AI config")
        
    def setup_db(self):
        """Initialize MongoDB for storage and memory as per Agno docs"""
        print("📦 Setting up MongoDB for Agno...")
        db_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        self.db = MongoDb(db_url=db_url)
        print("✅ MongoDB initialized successfully")
        
    def setup_knowledge(self):
        """Initialize Knowledge Base with Qdrant and AWS Titan Embeddings"""
        print("🧠 Setting up Knowledge Base with Qdrant and AWS Titan Embeddings...")
        
        embedder = AwsBedrockEmbedder(
            id="amazon.titan-embed-text-v2:0",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            aws_region=os.getenv("AWS_REGION", "us-west-2")
        )
        
        qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
        qdrant_api_key = os.getenv("QDRANT_API_KEY") 
        
        vector_db = Qdrant(
            url=qdrant_url,
            api_key=qdrant_api_key,
            collection="agno_knowledge",  
            embedder=embedder
        )
        
        self.knowledge = Knowledge(
            name="AgnoKnowledgeBase",
            description="Knowledge base for AI agent system with Qdrant and AWS embeddings",
            contents_db=self.db,
            vector_db=vector_db
        )
        
        print("✅ Knowledge Base initialized successfully")
        
        
    def _initialize_agents(self) -> Dict[str, Agent]:
        """Initialize all specialized agents using your legal AI pattern."""
        common_config = {
            "model": self.BASE_MODEL,
            "db": self.db,
            "knowledge": self.knowledge,
            "search_knowledge": True,
            "add_history_to_context": True,
            "num_history_runs": 5,
            "enable_user_memories": True,
            "enable_session_summaries": True,
            "enable_agentic_memory": True,
            "markdown": True,
        }

        search_instruction = (
            "To search the web for up-to-date information, use the search tools available to you. "
            "Provide detailed, well-sourced responses with clear citations."
        )

        file_gen_instruction = (
            "When appropriate, use file generation tools to create and export files like JSON, CSV, PDF, or text. "
            "Specify meaningful filenames and explain the generated content."
        )

        return {
            "research": Agent(
                name="ResearchAgent",
                instructions=(
                    f"You are an expert research specialist with access to web search capabilities and knowledge base. "
                    f"Your primary goal is to research current information, trends, and developments. "
                    f"{search_instruction} "
                    f"{file_gen_instruction} "
                    f"Focus on providing accurate research with proper citations and references. "
                    f"Be thorough but concise in your analysis."
                ),
                tools=[SerperTools(), FileTools(), FileGenerationTools(output_directory="tmp")],
                **common_config
            ),
            "analyze": Agent(
                name="AnalysisAgent",
                instructions=(
                    f"You are a data analysis and reasoning expert specializing in calculations "
                    f"and logical problem solving. Your primary goal is to analyze data, perform "
                    f"calculations, and break down complex problems step by step. "
                    f"{file_gen_instruction} "
                    f"Always show your reasoning process and methodology. "
                    f"Provide clear explanations for your analysis."
                ),
                tools=[PythonTools(), ReasoningTools(), FileGenerationTools(output_directory="tmp")],
                **common_config
            ),
            "general": Agent(
                name="GeneralAssistant",
                instructions=(
                    f"You are a helpful, intelligent AI assistant with access to various tools and knowledge base. "
                    f"Your primary goal is to provide comprehensive assistance by using appropriate "
                    f"tools based on the user's request. {search_instruction} "
                    f"{file_gen_instruction} "
                    f"Be friendly, professional, and thorough in your responses."
                ),
                tools=[SerperTools(), PythonTools(), FileGenerationTools(output_directory="tmp")],
                **common_config
            )
        }

    def _create_agent_team(self) -> Team:
        """Create a coordinated team using your legal AI Team pattern."""
        agents = self._initialize_agents()
        
        return Team(
            model=self.BASE_MODEL,
            members=list(agents.values()),
            db=self.db,
            knowledge=self.knowledge,
            search_knowledge=True,
            markdown=True,
            instructions=(
                "You are a coordinated team of specialists working together. "
                "Research Agent: Handle information gathering and web searches. "
                "Analysis Agent: Handle calculations, data analysis, and reasoning. "
                "General Assistant: Provide comprehensive general assistance. "
                "Work together to provide accurate, well-researched responses. "
                "Use file generation tools when needed to export results."
            )
        )

# Initialize the system
system = AgnoAISystem()

# Create output directory for file generation
os.makedirs("tmp", exist_ok=True)


# FastAPI endpoints
@app.get("/agents")
async def list_agents():
    return {"agents": ["research", "analyze", "general", "team"]}

@app.post("/run/{agent_type}")
async def run_agent(agent_type: str, request: QueryRequest):
    if agent_type == "team":
        agent = system.team
    elif agent_type in system.agents:
        agent = system.agents[agent_type]
    else:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    try:
        response = agent.run(request.query)
        return {"content": response.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        content = await file.read()
        filepath = os.path.join("tmp", file.filename)
        with open(filepath, "wb") as f:
            f.write(content)
        return {"filename": file.filename, "path": filepath}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/artifacts")
async def list_artifacts():
    try:
        files = [f for f in os.listdir("tmp") if os.path.isfile(os.path.join("tmp", f))]
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download/{filename}")
async def download_file(filename: str):
    filepath = os.path.join("tmp", filename)
    if os.path.exists(filepath):
        return FileResponse(filepath)
    raise HTTPException(status_code=404, detail="File not found")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        agent_type = data.get('agent_type')
        query = data.get('query')
        session_id = data.get('session_id', 'default')
        attached_file = data.get('attached_file')
        
        if not agent_type or not query:
            await websocket.send_json({"type": "error", "content": "Missing agent_type or query"})
            await websocket.close()
            return
        
        # If file is attached, read it and add context to query
        if attached_file:
            file_path = os.path.join("tmp", attached_file)
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        file_content = f.read()
                    query = f"{query}\n\n--- Attached File: {attached_file} ---\n{file_content}\n--- End of File ---"
                except Exception as e:
                    query = f"{query}\n\n[Note: Could not read file {attached_file}: {str(e)}]"
        
        # Select agent
        if agent_type == "team":
            agent = system.team
        elif agent_type in system.agents:
            agent = system.agents[agent_type]
        else:
            await websocket.send_json({"type": "error", "content": "Invalid agent_type"})
            await websocket.close()
            return
        
        # Send thinking status
        await websocket.send_json({"type": "thinking", "content": "Processing your request..."})
        
        loop = asyncio.get_running_loop()
        
        def run_agent():
            try:
                response = agent.run(query, user_id=session_id, stream=False)
                return response.content if response else "No response generated"
            except Exception as e:
                return f"Error: {str(e)}"
        
        # Run in executor to avoid blocking
        response_text = await loop.run_in_executor(None, run_agent)
        
        # Send complete response in chunks (word by word for smooth streaming)
        words = response_text.split(' ')
        for i, word in enumerate(words):
            chunk = word + (' ' if i < len(words) - 1 else '')
            await websocket.send_json({"type": "chunk", "content": chunk})
            await asyncio.sleep(0.03)  # Smooth streaming delay
        
        # Send completion signal
        await websocket.send_json({"type": "done"})
        await websocket.close()
    
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket error: {str(e)}")
        try:
            await websocket.send_json({"type": "error", "content": str(e)})
            await websocket.close()
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
